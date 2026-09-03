import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getStudentChargeBalances,
  getStudentPaymentDetails,
  type StudentChargeBalance,
  type StudentPaymentDetail,
} from "@/lib/admin/student-account"
import { getPaymentFormContext } from "@/lib/admin/payments"
import { getStudentEmailRecipients } from "@/lib/email/recipients"

export type AdminHomeOverdueItem = {
  studentId: string
  studentName: string
  gradeName: string
  groupName: string | null
  overdueAmount: string
}

export type AdminHomeRecentPayment = {
  studentId: string
  studentName: string
  payment: StudentPaymentDetail
  charges: StudentChargeBalance[]
  hasEmailRecipients: boolean
}

export type AdminHomeData = {
  paymentsToday: string
  overdueTotal: string
  pendingStudents: number
  overdueItems: AdminHomeOverdueItem[]
  recentPayments: AdminHomeRecentPayment[]
  hasError: boolean
}

type OverdueRow = {
  student_id: unknown
  student_name: unknown
  grade_name: unknown
  group_name: unknown
  overdue_amount: unknown
}

type PaymentAmountRow = { amount: unknown }
type AdminPaymentRow = {
  id: unknown
  student_id: unknown
  students: unknown
}

export async function getAdminHomeData(
  supabase: SupabaseClient,
  userId: string,
  isMaster: boolean,
  cycle: { id: string }
): Promise<AdminHomeData> {
  const today = mazatlanDayRange(new Date())
  const overduePromise = supabase.rpc("admin_home_overdue_summary", { p_cycle_id: cycle.id })
  const paymentContextPromise = isMaster
    ? Promise.resolve({ data: null, error: null })
    : getPaymentFormContext(supabase, userId)
  const masterTodayPaymentsPromise = isMaster
    ? paymentsTodayQuery(supabase, today)
    : Promise.resolve({ data: null, error: null })
  const masterRecentPaymentsPromise = isMaster
    ? recentPaymentsQuery(supabase)
    : Promise.resolve({ data: null, error: null })

  const [overdueResult, paymentContextResult, masterTodayPaymentsResult, masterRecentPaymentsResult] = await Promise.all([
    overduePromise,
    paymentContextPromise,
    masterTodayPaymentsPromise,
    masterRecentPaymentsPromise,
  ])

  if (overdueResult.error || paymentContextResult.error || masterTodayPaymentsResult.error || masterRecentPaymentsResult.error) return emptyHomeData(true)

  const overdueRows = (overdueResult.data as OverdueRow[] | null) ?? []
  const overdueItems = overdueRows.map((row) => ({
    studentId: text(row.student_id),
    studentName: text(row.student_name),
    gradeName: text(row.grade_name),
    groupName: nullableText(row.group_name),
    overdueAmount: amount(row.overdue_amount),
  })).filter((item) => item.studentId && item.studentName)
  const overdueTotal = overdueItems.reduce((total, item) => total + number(item.overdueAmount), 0).toFixed(2)

  if (isMaster) {
    const paymentsToday = sumPayments((masterTodayPaymentsResult.data as unknown as PaymentAmountRow[] | null) ?? [])
    const recentPayments = await enrichDirectPayments(
      supabase,
      (masterRecentPaymentsResult.data as AdminPaymentRow[] | null) ?? []
    )

    return { paymentsToday, overdueTotal, pendingStudents: overdueItems.length, overdueItems: overdueItems.slice(0, 5), recentPayments, hasError: false }
  }

  const staffId = paymentContextResult.data?.currentReceiverId
  if (!staffId) return { paymentsToday: "0.00", overdueTotal, pendingStudents: overdueItems.length, overdueItems: overdueItems.slice(0, 5), recentPayments: [], hasError: false }

  const [todayPaymentsResult, paymentsResult] = await Promise.all([
    paymentsTodayQuery(supabase, today, staffId),
    recentPaymentsQuery(supabase, staffId)
  ])

  if (todayPaymentsResult.error || paymentsResult.error) return emptyHomeData(true)
  const paymentsToday = sumPayments((todayPaymentsResult.data as unknown as PaymentAmountRow[] | null) ?? [])
  const recentPayments = await enrichDirectPayments(supabase, (paymentsResult.data as unknown as AdminPaymentRow[] | null) ?? [])

  return { paymentsToday, overdueTotal, pendingStudents: overdueItems.length, overdueItems: overdueItems.slice(0, 5), recentPayments, hasError: false }
}

async function enrichDirectPayments(supabase: SupabaseClient, rows: AdminPaymentRow[]) {
  const items = await Promise.all(rows.map(async (row) => {
    const studentId = text(row.student_id)
    const paymentId = text(row.id)
    if (!studentId || !paymentId) return []
    const [detailsResult, chargesResult, recipientsResult] = await Promise.all([
      getStudentPaymentDetails(supabase, studentId, [paymentId]),
      getStudentChargeBalances(supabase, studentId),
      getStudentEmailRecipients(supabase, studentId),
    ])
    const payment = detailsResult.data[0]
    const student = record(row.students)
    return payment ? [{
      studentId,
      studentName: text(student?.full_name),
      payment,
      charges: chargesResult.error ? [] : chargesResult.data,
      hasEmailRecipients: !recipientsResult.error && recipientsResult.data.length > 0,
    }] : []
  }))

  return items.flat()
}

function recentPaymentsQuery(supabase: SupabaseClient, staffId?: string) {
  const query = confirmedPaymentsQuery(supabase, "id, student_id, students!inner(full_name)")
  const scopedQuery = staffId ? query.eq("received_by_staff_id", staffId) : query

  return scopedQuery
    .order("received_at", { ascending: false })
    .limit(5)
}

function paymentsTodayQuery(
  supabase: SupabaseClient,
  today: { startUtc: string; endUtc: string },
  staffId?: string
) {
  const query = confirmedPaymentsQuery(supabase, "amount")
  const scopedQuery = staffId ? query.eq("received_by_staff_id", staffId) : query

  return scopedQuery
    .gte("received_at", today.startUtc)
    .lt("received_at", today.endUtc)
}

function confirmedPaymentsQuery(supabase: SupabaseClient, columns: string) {
  return supabase
    .from("payments")
    .select(columns)
    .eq("status", "CONFIRMED")
}

function emptyHomeData(hasError: boolean): AdminHomeData {
  return { paymentsToday: "0.00", overdueTotal: "0.00", pendingStudents: 0, overdueItems: [], recentPayments: [], hasError }
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function text(value: unknown) { return typeof value === "string" ? value : "" }
function nullableText(value: unknown) { const result = text(value); return result || null }
function amount(value: unknown) { return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00" }
function number(value: string) { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function sumPayments(rows: PaymentAmountRow[]) { return rows.reduce((total, row) => total + number(amount(row.amount)), 0).toFixed(2) }
function mazatlanDayRange(now: Date) {
  const timeZone = "America/Mazatlan"
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const localDate = `${values.year}-${values.month}-${values.day}`
  const startUtc = localMidnightAsUtc(localDate, timeZone)
  const nextLocalDate = new Date(`${localDate}T12:00:00.000Z`)
  nextLocalDate.setUTCDate(nextLocalDate.getUTCDate() + 1)
  const nextDate = nextLocalDate.toISOString().slice(0, 10)

  return {
    startUtc: startUtc.toISOString(),
    endUtc: localMidnightAsUtc(nextDate, timeZone).toISOString(),
  }
}

function localMidnightAsUtc(localDate: string, timeZone: string) {
  const utcGuess = new Date(`${localDate}T00:00:00.000Z`)
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(utcGuess)
  const offset = offsetParts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00"
  const match = offset.match(/GMT([+-])(\d{2}):?(\d{2})?$/)
  if (!match) return utcGuess

  const minutes = (Number(match[2]) * 60) + Number(match[3] ?? 0)
  const signedMinutes = match[1] === "+" ? minutes : -minutes
  return new Date(utcGuess.getTime() - signedMinutes * 60_000)
}
