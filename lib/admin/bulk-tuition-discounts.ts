import type { SupabaseClient } from "@supabase/supabase-js"

export type BulkTuitionDiscountCandidate = {
  enrollmentId: string
  studentId: string
  fullName: string
  studentCode: string | null
  levelName: string
  gradeName: string
  group: { name: string; code: string } | null
  currentDiscountName: string | null
  baseAmount: number | null
  agreedAmount: number | null
}

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === "object")
    : []
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export async function getBulkTuitionDiscountCandidates(
  supabase: SupabaseClient,
  cycleId: string
): Promise<{ data: BulkTuitionDiscountCandidate[]; error: boolean }> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student_id, students!inner(id, full_name, student_code), grade_levels!inner(name, education_levels!inner(name)), groups(name, code), student_financial_agreements(agreed_amount, base_amount_snapshot, valid_until, financial_concepts!inner(code)), enrollment_tuition_discount_assignments(valid_until, tuition_discount_categories(name))")
    .eq("cycle_id", cycleId)
    .eq("status", "ACTIVA")
    .order("full_name", { referencedTable: "students", ascending: true })

  if (error) return { data: [], error: true }

  return {
    data: ((data ?? []) as unknown as RecordValue[]).flatMap((enrollment) => {
      const student = record(enrollment.students)
      const grade = record(enrollment.grade_levels)
      const level = record(grade?.education_levels)
      const group = record(enrollment.groups)
      const tuitionAgreement = records(enrollment.student_financial_agreements).find((agreement) => {
        const concept = record(agreement.financial_concepts)
        return agreement.valid_until === null && text(concept?.code) === "TUITION"
      })
      const discountAssignment = records(enrollment.enrollment_tuition_discount_assignments).find(
        (assignment) => assignment.valid_until === null
      )
      const discountCategory = record(discountAssignment?.tuition_discount_categories)
      const baseAmount = tuitionAgreement ? Number(tuitionAgreement.base_amount_snapshot) : Number.NaN
      const agreedAmount = tuitionAgreement ? Number(tuitionAgreement.agreed_amount) : Number.NaN

      if (
        !student ||
        !grade ||
        !level ||
        !text(enrollment.id) ||
        !text(enrollment.student_id) ||
        discountAssignment
      ) return []

      return [{
        enrollmentId: text(enrollment.id),
        studentId: text(enrollment.student_id),
        fullName: text(student.full_name),
        studentCode: typeof student.student_code === "string" ? student.student_code : null,
        levelName: text(level.name),
        gradeName: text(grade.name),
        group: group ? { name: text(group.name), code: text(group.code) } : null,
        currentDiscountName: discountCategory ? text(discountCategory.name) : null,
        baseAmount: Number.isFinite(baseAmount) ? baseAmount : null,
        agreedAmount: Number.isFinite(agreedAmount) ? agreedAmount : null,
      }]
    }),
    error: false,
  }
}
