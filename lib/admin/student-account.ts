import type { SupabaseClient } from "@supabase/supabase-js"

export type StudentAccountSummary = {
  outstandingTotal: string
  overdueTotal: string
  availableCredit: string
  isCurrent: boolean
}

export type StudentChargeBalance = {
  id: string
  cycleId: string
  cycleCode: string
  conceptCode: string
  conceptName: string
  coverageYear: number | null
  coverageMonth: number | null
  dueDate: string
  effectiveAmount: string
  paymentApplied: string
  creditApplied: string
  totalApplied: string
  outstandingAmount: string
  isPaid: boolean
  isOverdue: boolean
}

export type StudentAccountMovement = {
  id: string
  parentId: string | null
  movementOn: string
  recordedAt: string
  movementType: string
  description: string
  receivedByNameSnapshot: string | null
  debit: string
  credit: string
  status: string
}

export type StudentAccount = {
  summary: StudentAccountSummary
  charges: StudentChargeBalance[]
  movements: StudentAccountMovement[]
}

export type StudentPaymentDetail = {
  id: string
  amount: string
  receivedAt: string
  methodName: string
  receivedByName: string
  receivedByStaffId: string | null
  bankReference: string | null
  notes: string | null
  receiptVisibleNote: string | null
  status: string
  allocations: Array<{ chargeId: string; amount: string }>
}

type AccountRpcResult<T> = {
  data: T[] | null
  error: unknown
}

type AccountSummaryRow = {
  outstanding_total: unknown
  overdue_total: unknown
  available_credit: unknown
  is_current: unknown
}

type ChargeBalanceRow = {
  charge_id: unknown
  cycle_id: unknown
  cycle_code: unknown
  concept_code: unknown
  concept_name: unknown
  coverage_year: unknown
  coverage_month: unknown
  due_date: unknown
  effective_amount: unknown
  payment_applied: unknown
  credit_applied: unknown
  total_applied: unknown
  outstanding_amount: unknown
  is_paid: unknown
  is_overdue: unknown
}

type AccountMovementRow = {
  reference_id: unknown
  parent_reference_id: unknown
  movement_on: unknown
  recorded_at: unknown
  movement_type: unknown
  description: unknown
  received_by_name_snapshot: unknown
  debit: unknown
  credit: unknown
  status: unknown
}

type PaymentDetailRow = {
  id: unknown
  amount: unknown
  received_at: unknown
  method_name_snapshot: unknown
  received_by_name_snapshot: unknown
  received_by_staff_id: unknown
  bank_reference: unknown
  notes: unknown
  receipt_visible_note: unknown
  status: unknown
}

type PaymentAllocationRow = {
  payment_id: unknown
  charge_id: unknown
  amount: unknown
}

export async function getStudentAccountSummary(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ data: StudentAccountSummary | null; error: boolean }> {
  const result = (await supabase.rpc("student_account_summary", {
    p_student_id: studentId,
  })) as AccountRpcResult<AccountSummaryRow>

  if (result.error) return { data: null, error: true }

  return {
    data: result.data?.[0] ? mapSummary(result.data[0]) : null,
    error: false,
  }
}

export async function getStudentChargeBalances(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ data: StudentChargeBalance[]; error: boolean }> {
  const result = (await supabase.rpc("student_charge_balances", {
    p_student_id: studentId,
  })) as AccountRpcResult<ChargeBalanceRow>

  if (result.error) return { data: [], error: true }

  return {
    data: (result.data ?? []).map(mapCharge),
    error: false,
  }
}

export async function getStudentAccount(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ data: StudentAccount | null; error: boolean }> {
  const [summaryResult, chargesResult, movementsResult] = await Promise.all([
    supabase.rpc("student_account_summary", { p_student_id: studentId }),
    supabase.rpc("student_charge_balances", { p_student_id: studentId }),
    supabase.rpc("student_account_movements", { p_student_id: studentId }),
  ])

  if (summaryResult.error || chargesResult.error || movementsResult.error) {
    return { data: null, error: true }
  }

  const summaries = summaryResult.data as AccountSummaryRow[] | null
  const charges = chargesResult.data as ChargeBalanceRow[] | null
  const movements = movementsResult.data as AccountMovementRow[] | null

  if (!summaries?.[0]) return { data: null, error: false }

  return {
    data: {
      summary: mapSummary(summaries[0]),
      charges: (charges ?? []).map(mapCharge),
      movements: (movements ?? []).map(mapMovement),
    },
    error: false,
  }
}

export async function getStudentPaymentDetails(
  supabase: SupabaseClient,
  studentId: string,
  paymentIds: string[]
): Promise<{ data: StudentPaymentDetail[]; error: boolean }> {
  if (!paymentIds.length) return { data: [], error: false }

  const [paymentsResult, allocationsResult] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, amount, received_at, method_name_snapshot, received_by_name_snapshot, received_by_staff_id, bank_reference, notes, receipt_visible_note, status"
      )
      .eq("student_id", studentId)
      .in("id", paymentIds),
    supabase
      .from("payment_allocations")
      .select("payment_id, charge_id, amount")
      .in("payment_id", paymentIds)
      .is("reversed_at", null),
  ])

  if (paymentsResult.error || allocationsResult.error) {
    return { data: [], error: true }
  }

  const allocationsByPayment = new Map<string, StudentPaymentDetail["allocations"]>()
  for (const row of (allocationsResult.data as PaymentAllocationRow[] | null) ?? []) {
    const paymentId = text(row.payment_id)
    if (!paymentId) continue

    const allocations = allocationsByPayment.get(paymentId) ?? []
    allocations.push({
      chargeId: text(row.charge_id),
      amount: amountText(row.amount),
    })
    allocationsByPayment.set(paymentId, allocations)
  }

  return {
    data: ((paymentsResult.data as PaymentDetailRow[] | null) ?? []).map((row) => {
      const id = text(row.id)

      return {
        id,
        amount: amountText(row.amount),
        receivedAt: text(row.received_at),
        methodName: text(row.method_name_snapshot),
        receivedByName: text(row.received_by_name_snapshot),
        receivedByStaffId: nullableText(row.received_by_staff_id),
        bankReference: nullableText(row.bank_reference),
        notes: nullableText(row.notes),
        receiptVisibleNote: nullableText(row.receipt_visible_note),
        status: text(row.status),
        allocations: allocationsByPayment.get(id) ?? [],
      }
    }),
    error: false,
  }
}

function mapSummary(row: AccountSummaryRow): StudentAccountSummary {
  return {
    outstandingTotal: amountText(row.outstanding_total),
    overdueTotal: amountText(row.overdue_total),
    availableCredit: amountText(row.available_credit),
    isCurrent: row.is_current === true,
  }
}

function mapCharge(row: ChargeBalanceRow): StudentChargeBalance {
  return {
    id: text(row.charge_id),
    cycleId: text(row.cycle_id),
    cycleCode: text(row.cycle_code),
    conceptCode: text(row.concept_code),
    conceptName: text(row.concept_name),
    coverageYear: numberOrNull(row.coverage_year),
    coverageMonth: numberOrNull(row.coverage_month),
    dueDate: text(row.due_date),
    effectiveAmount: amountText(row.effective_amount),
    paymentApplied: amountText(row.payment_applied),
    creditApplied: amountText(row.credit_applied),
    totalApplied: amountText(row.total_applied),
    outstandingAmount: amountText(row.outstanding_amount),
    isPaid: row.is_paid === true,
    isOverdue: row.is_overdue === true,
  }
}

function mapMovement(row: AccountMovementRow): StudentAccountMovement {
  return {
    id: text(row.reference_id),
    parentId: nullableText(row.parent_reference_id),
    movementOn: text(row.movement_on),
    recordedAt: text(row.recorded_at),
    movementType: text(row.movement_type),
    description: text(row.description),
    receivedByNameSnapshot: nullableText(row.received_by_name_snapshot),
    debit: amountText(row.debit),
    credit: amountText(row.credit),
    status: text(row.status),
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function nullableText(value: unknown) {
  const parsed = text(value)
  return parsed || null
}

function amountText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "0"
}

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function formatCurrency(value: string) {
  const parsed = Number(value)

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(parsed) ? parsed : 0)
}
