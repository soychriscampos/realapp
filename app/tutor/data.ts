import type { SupabaseClient } from "@supabase/supabase-js"
import { getStudentAccount, getStudentAccountSummary, type StudentAccount, type StudentAccountMovement } from "@/lib/admin/student-account"

export type TutorStudent = {
  id: string
  fullName: string
  studentCode: string | null
  enrollment: { cycleName: string; levelName: string; gradeName: string; groupName: string | null } | null
}

export type TutorCycle = {
  id: string
  name: string
  startsOn: string
  endsOn: string
  status: string
}

export type TutorTuitionAgreement = {
  studentId: string
  enrollmentId: string
  cycleId: string
  agreedAmount: string | null
  hasMultipleAmounts: boolean
  agreementCount: number
}

export type TutorContact = {
  guardian_id: string
  full_name: string | null
  phone: string | null
  email: string | null
  relationship: string | null
  via_whatsapp: boolean
  via_email: boolean
}

type TutorRelation = { name: string; status?: string }
type TutorGrade = TutorRelation & { education_levels?: TutorRelation | TutorRelation[] | null }
type TutorEnrollment = {
  status?: string
  school_cycles?: TutorRelation | TutorRelation[] | null
  grade_levels?: TutorGrade | TutorGrade[] | null
  groups?: TutorRelation | TutorRelation[] | null
}

export async function getTutorStudents(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, student_code, enrollments(cycle_id, status, school_cycles(name, status), grade_levels(name, education_levels(name)), groups(name))")
    .order("full_name")

  if (error) return { students: [] as TutorStudent[], error: true }
  return {
    students: (data ?? []).map((row) => {
      const enrollments = (Array.isArray(row.enrollments) ? row.enrollments : []) as TutorEnrollment[]
      const enrollment = enrollments.find((item) => item.status === "ACTIVA" && (Array.isArray(item.school_cycles) ? item.school_cycles[0]?.status : item.school_cycles?.status) === "ACTIVE")
      const cycle = enrollment?.school_cycles && (Array.isArray(enrollment.school_cycles) ? enrollment.school_cycles[0] : enrollment.school_cycles)
      const grade = enrollment?.grade_levels && (Array.isArray(enrollment.grade_levels) ? enrollment.grade_levels[0] : enrollment.grade_levels)
      const level = grade?.education_levels && (Array.isArray(grade.education_levels) ? grade.education_levels[0] : grade.education_levels)
      const group = enrollment?.groups && (Array.isArray(enrollment.groups) ? enrollment.groups[0] : enrollment.groups)
      return {
        id: row.id,
        fullName: row.full_name,
        studentCode: row.student_code,
        enrollment: cycle && grade && level ? { cycleName: cycle.name, levelName: level.name, gradeName: grade.name, groupName: group?.name ?? null } : null,
      }
    }),
    error: false,
  }
}

export function chooseTutorStudent(students: TutorStudent[], requestedId?: string) {
  return students.find((student) => student.id === requestedId) ?? students[0] ?? null
}

export function chooseTutorCycle(cycles: TutorCycle[], requestedId?: string) {
  const requested = cycles.find((cycle) => cycle.id === requestedId)
  if (requested) return requested
  const today = new Date().toISOString().slice(0, 10)
  return cycles.find((cycle) => cycle.startsOn <= today && cycle.endsOn >= today)
    ?? [...cycles].sort((left, right) => right.endsOn.localeCompare(left.endsOn))[0]
    ?? null
}

export async function getTutorCycles(supabase: SupabaseClient, studentId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("cycle_id, school_cycles!inner(id, name, starts_on, ends_on, status)")
    .eq("student_id", studentId)

  if (error) return { cycles: [] as TutorCycle[], error: true }
  const cycles = new Map<string, TutorCycle>()
  for (const row of data ?? []) {
    const cycle = Array.isArray(row.school_cycles) ? row.school_cycles[0] : row.school_cycles
    if (!cycle || cycles.has(row.cycle_id)) continue
    cycles.set(row.cycle_id, { id: cycle.id, name: cycle.name, startsOn: cycle.starts_on, endsOn: cycle.ends_on, status: cycle.status })
  }
  return { cycles: [...cycles.values()].sort((left, right) => right.startsOn.localeCompare(left.startsOn)), error: false }
}

export async function getTutorTuitionAgreement(supabase: SupabaseClient, studentId: string, cycleId: string) {
  const { data, error } = await supabase.rpc("family_student_tuition_agreement", { p_student_id: studentId, p_cycle_id: cycleId })
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  if (error || !row) return { agreement: null, error: Boolean(error) }
  return {
    agreement: {
      studentId: String(row.student_id),
      enrollmentId: String(row.enrollment_id),
      cycleId: String(row.cycle_id),
      agreedAmount: row.agreed_amount === null || row.agreed_amount === undefined ? null : String(row.agreed_amount),
      hasMultipleAmounts: row.has_multiple_amounts === true,
      agreementCount: Number(row.agreement_count),
    } satisfies TutorTuitionAgreement,
    error: false,
  }
}

export async function getTutorGuardian(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("guardians").select("id, full_name, phone, email").not("auth_user_id", "is", null).maybeSingle()
  return { guardian: data, error: Boolean(error) }
}

export async function getTutorStudentContacts(supabase: SupabaseClient, studentId: string) {
  const { data, error } = await supabase.rpc("family_student_contacts", { p_student_id: studentId })
  if (!error) return { contacts: (data ?? []) as TutorContact[], error: false }

  const fallback = await supabase
    .from("student_guardians")
    .select("guardian_id, relationship, via_whatsapp, via_email, guardians!inner(id, full_name, phone, email)")
    .eq("student_id", studentId)
    .eq("is_active", true)
  const contacts = (fallback.data ?? []).map((row) => {
    const guardian = Array.isArray(row.guardians) ? row.guardians[0] : row.guardians
    return {
      guardian_id: row.guardian_id,
      full_name: guardian?.full_name ?? null,
      phone: guardian?.phone ?? null,
      email: guardian?.email ?? null,
      relationship: row.relationship,
      via_whatsapp: row.via_whatsapp,
      via_email: row.via_email,
    }
  }) as TutorContact[]
  return { contacts, error: Boolean(fallback.error) }
}

export type TutorPayment = {
  id: string
  amount: string
  receivedAt: string
  methodName: string
  receivedByName: string
}

export type TutorAccount = StudentAccount & { payments: TutorPayment[] }

export async function getTutorAccount(supabase: SupabaseClient, studentId: string): Promise<{ account: TutorAccount | null; error: boolean }> {
  const accountResult = await getStudentAccount(supabase, studentId)
  if (!accountResult.data) return { account: null, error: accountResult.error }
  return { account: { ...accountResult.data, payments: accountResult.data.movements.filter(isConfirmedPayment).map(mapPayment) }, error: accountResult.error }
}

export async function getTutorSummaries(supabase: SupabaseClient, students: TutorStudent[]) {
  const results = await Promise.all(students.map((student) => getStudentAccountSummary(supabase, student.id)))
  return new Map(students.map((student, index) => [student.id, results[index].data] as const))
}

export async function getTutorRecentPayments(supabase: SupabaseClient, students: TutorStudent[]) {
  const results = await Promise.all(students.map(async (student) => {
    const result = (await supabase.rpc("student_account_movements", { p_student_id: student.id })) as { data: StudentAccountMovement[] | null; error: unknown }
    return result.error ? [] : (result.data ?? []).filter(isConfirmedPayment).map((movement) => ({ ...mapPayment(movement), studentName: student.fullName }))
  }))
  return results.flat().sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)).slice(0, 8)
}

function isConfirmedPayment(movement: StudentAccountMovement) {
  return movement.movementType === "PAYMENT" && movement.status === "CONFIRMED"
}

function mapPayment(movement: StudentAccountMovement): TutorPayment {
  const [, ...methodParts] = movement.description.split(" · ")
  return {
    id: movement.id,
    amount: movement.credit,
    receivedAt: movement.recordedAt,
    methodName: methodParts.join(" · ") || movement.description,
    receivedByName: movement.receivedByNameSnapshot ?? "Personal administrativo",
  }
}
