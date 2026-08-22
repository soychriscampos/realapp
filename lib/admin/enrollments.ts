import type { SupabaseClient } from "@supabase/supabase-js"

import { buildStudentNameSearchPattern } from "@/lib/admin/students"

export type EnrollmentFilters = {
  cycleId: string
  query?: string
  educationLevelId?: string
  gradeLevelId?: string
  groupId?: string
  classificationId?: string
  status?: string
}

export type EnrollmentListItem = {
  id: string
  cycleId: string
  cycle: { name: string; startsOn: string; endsOn: string }
  status: string
  enrolledOn: string
  closedOn: string | null
  classesStartOn: string | null
  student: { id: string; fullName: string; studentCode: string | null }
  educationLevel: { id: string; name: string }
  gradeLevel: { id: string; name: string }
  group: { id: string; name: string; code: string } | null
  classification: { id: string; name: string }
  currentPlan: { id: string; installmentCount: number } | null
  tuitionAgreements: Array<{ agreedAmount: number; validFrom: string; validUntil: string | null }>
}

export type FinancialPlanOption = {
  id: string
  cycleId: string
  educationLevelId: string
  installmentCount: number
  status: string
}

export type EnrollmentFinancialCoverage = {
  cycleId: string
  educationLevelId: string
  months: Array<{ year: number; month: number }>
}

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null
}

function asRecords(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === "object")
    : []
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export async function getEnrollments(
  supabase: SupabaseClient,
  filters: EnrollmentFilters
): Promise<{ data: EnrollmentListItem[]; error: boolean }> {
  let query = supabase
    .from("enrollments")
    .select(
      "id, cycle_id, status, enrolled_on, closed_on, classes_start_on, school_cycles!inner(name, starts_on, ends_on), students!inner(id, full_name, student_code), grade_levels!inner(id, name, education_level_id, education_levels!inner(id, name)), groups(id, name, code), enrollment_classifications!inner(id, name), enrollment_financial_plan_assignments(id, financial_plan_id, valid_until, financial_plans!inner(id, installment_count, cycle_id, education_level_id, status)), student_financial_agreements(agreed_amount, valid_from, valid_until, financial_concepts!inner(code))"
    )
    .eq("cycle_id", filters.cycleId)
    .order("enrolled_on", { ascending: false })
    .order("full_name", { referencedTable: "students", ascending: true })
    .limit(100)

  if (filters.query) {
    query = query.filter(
      "students.full_name",
      "imatch",
      buildStudentNameSearchPattern(filters.query)
    )
  }

  if (filters.educationLevelId) {
    query = query.eq("grade_levels.education_level_id", filters.educationLevelId)
  }
  if (filters.gradeLevelId) query = query.eq("grade_level_id", filters.gradeLevelId)
  if (filters.groupId) query = query.eq("group_id", filters.groupId)
  if (filters.classificationId) {
    query = query.eq("classification_id", filters.classificationId)
  }
  if (filters.status) query = query.eq("status", filters.status)

  const { data, error } = await query
  if (error) return { data: [], error: true }

  return {
    data: ((data ?? []) as unknown as RecordValue[]).flatMap((row) => {
      const student = record(row.students)
      const cycle = record(row.school_cycles)
      const gradeLevel = record(row.grade_levels)
      const educationLevel = record(gradeLevel?.education_levels)
      const classification = record(row.enrollment_classifications)
      const group = record(row.groups)
      const currentAssignment = asRecords(row.enrollment_financial_plan_assignments).find(
        (assignment) => assignment.valid_until === null
      )
      const currentPlan = record(currentAssignment?.financial_plans)
      const tuitionAgreements = asRecords(row.student_financial_agreements).flatMap((agreement) => {
        const concept = record(agreement.financial_concepts)
        const agreedAmount = Number(agreement.agreed_amount)
        const validFrom = text(agreement.valid_from)

        if (
          text(concept?.code) !== "TUITION" ||
          !Number.isFinite(agreedAmount) ||
          !validFrom
        ) return []

        return [{
          agreedAmount,
          validFrom,
          validUntil: typeof agreement.valid_until === "string" ? agreement.valid_until : null,
        }]
      })

      if (!student || !cycle || !gradeLevel || !educationLevel || !classification) return []

      return [{
        id: text(row.id),
        cycleId: text(row.cycle_id),
        cycle: { name: text(cycle.name), startsOn: text(cycle.starts_on), endsOn: text(cycle.ends_on) },
        status: text(row.status),
        enrolledOn: text(row.enrolled_on),
        closedOn: typeof row.closed_on === "string" ? row.closed_on : null,
        classesStartOn: typeof row.classes_start_on === "string" ? row.classes_start_on : null,
        student: {
          id: text(student.id),
          fullName: text(student.full_name),
          studentCode: typeof student.student_code === "string" ? student.student_code : null,
        },
        educationLevel: { id: text(educationLevel.id), name: text(educationLevel.name) },
        gradeLevel: { id: text(gradeLevel.id), name: text(gradeLevel.name) },
        group: group ? { id: text(group.id), name: text(group.name), code: text(group.code) } : null,
        classification: { id: text(classification.id), name: text(classification.name) },
        currentPlan: currentPlan
          ? { id: text(currentPlan.id), installmentCount: Number(currentPlan.installment_count) }
          : null,
        tuitionAgreements,
      }]
    }),
    error: false,
  }
}

export async function getTenPaymentPlans(
  supabase: SupabaseClient
): Promise<{ data: FinancialPlanOption[]; error: boolean }> {
  const { data, error } = await supabase
    .from("financial_plans")
    .select("id, cycle_id, education_level_id, installment_count, status")
    .eq("installment_count", 10)
    .neq("status", "INACTIVE")
    .order("cycle_id")

  if (error) return { data: [], error: true }

  return {
    data: (data ?? []).map((plan) => ({
      id: plan.id,
      cycleId: plan.cycle_id,
      educationLevelId: plan.education_level_id,
      installmentCount: plan.installment_count,
      status: plan.status,
    })),
    error: false,
  }
}

export function getEnrollmentGroupLabel(group: { name: string; code: string }) {
  const source = group.code.trim() || group.name.trim()
  const match = source.match(/[\p{L}\d]\s*$/u)
  return match?.[0]?.trim().toUpperCase() ?? source
}

export async function getEnrollmentFinancialCoverage(
  supabase: SupabaseClient
): Promise<{ data: EnrollmentFinancialCoverage[]; error: boolean }> {
  const { data: plans, error: plansError } = await supabase
    .from("financial_plans")
    .select("id, cycle_id, education_level_id")
    .eq("is_default", true)
    .eq("installment_count", 12)
    .neq("status", "INACTIVE")

  if (plansError || !plans?.length) {
    return { data: [], error: Boolean(plansError) }
  }

  const { data: periods, error: periodsError } = await supabase
    .from("financial_plan_periods")
    .select("financial_plan_id, coverage_year, coverage_month, financial_concepts!inner(code)")
    .in("financial_plan_id", plans.map((plan) => plan.id))
    .eq("financial_concepts.code", "TUITION")

  if (periodsError) return { data: [], error: true }

  return {
    data: plans.map((plan) => ({
      cycleId: plan.cycle_id,
      educationLevelId: plan.education_level_id,
      months: (periods ?? []).flatMap((period) =>
        period.financial_plan_id === plan.id &&
        typeof period.coverage_year === "number" &&
        typeof period.coverage_month === "number"
          ? [{ year: period.coverage_year, month: period.coverage_month }]
          : []
      ),
    })),
    error: false,
  }
}
