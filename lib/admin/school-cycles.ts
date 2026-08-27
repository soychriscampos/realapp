import type { SupabaseClient } from "@supabase/supabase-js"

export type SchoolCycle = {
  id: string
  code: string
  name: string
  startsOn: string
  endsOn: string
  status: "PREPARATION" | "ACTIVE" | "CLOSED"
}

export type SchoolCycleLevel = {
  id: string
  code: string
  name: string
  sortOrder: number
  grades: SchoolCycleGrade[]
}

export type SchoolCycleGrade = {
  id: string
  educationLevelId: string
  code: string
  name: string
  sortOrder: number
  groups: SchoolCycleGroup[]
}

export type SchoolCycleGroup = {
  id: string
  cycleId: string
  gradeLevelId: string
  code: string
  name: string
  isActive: boolean
}

export type SchoolCycleRate = {
  id: string
  educationLevelId: string
  financialConceptId: string
  conceptCode: "TUITION" | "ENROLLMENT_FEE"
  amount: number
  validFrom: string
  validUntil: string | null
}

export type SchoolCycleDetail = SchoolCycle & {
  levels: SchoolCycleLevel[]
  rates: SchoolCycleRate[]
  groups: SchoolCycleGroup[]
}

export async function getSchoolCycles(supabase: SupabaseClient): Promise<{ data: SchoolCycle[]; error: boolean }> {
  const { data, error } = await supabase
    .from("school_cycles")
    .select("id, code, name, starts_on, ends_on, status")
    .order("starts_on", { ascending: false })

  if (error) return { data: [], error: true }

  return {
    data: (data ?? []).flatMap((cycle) => {
      if (cycle.status !== "PREPARATION" && cycle.status !== "ACTIVE" && cycle.status !== "CLOSED") return []
      return [{
        id: cycle.id,
        code: cycle.code,
        name: cycle.name,
        startsOn: cycle.starts_on,
        endsOn: cycle.ends_on,
        status: cycle.status,
      }]
    }),
    error: false,
  }
}

export async function getSchoolCycleDetail(
  supabase: SupabaseClient,
  cycleId: string
): Promise<{ data: SchoolCycleDetail | null; error: boolean }> {
  const [cycleResult, levelsResult, gradesResult, conceptsResult, ratesResult, groupsResult] = await Promise.all([
    supabase.from("school_cycles").select("id, code, name, starts_on, ends_on, status").eq("id", cycleId).maybeSingle(),
    supabase.from("education_levels").select("id, code, name, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("grade_levels").select("id, education_level_id, code, name, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("financial_concepts").select("id, code").in("code", ["TUITION", "ENROLLMENT_FEE"]),
    supabase.from("base_rates").select("id, cycle_id, education_level_id, financial_concept_id, amount, valid_from, valid_until").eq("cycle_id", cycleId).order("valid_from", { ascending: false }),
    supabase.from("groups").select("id, cycle_id, grade_level_id, code, name, is_active").eq("cycle_id", cycleId).order("grade_level_id").order("code"),
  ])

  if (cycleResult.error || levelsResult.error || gradesResult.error || conceptsResult.error || ratesResult.error || groupsResult.error) {
    return { data: null, error: true }
  }
  if (!cycleResult.data || !isCycleStatus(cycleResult.data.status)) return { data: null, error: false }

  const conceptCodes = new Map((conceptsResult.data ?? []).map((concept) => [concept.id, concept.code]))

  const grades = (gradesResult.data ?? []).map((grade) => ({
    id: grade.id,
    educationLevelId: grade.education_level_id,
    code: grade.code,
    name: grade.name,
    sortOrder: grade.sort_order,
    groups: (groupsResult.data ?? []).filter((group) => group.grade_level_id === grade.id).map(mapGroup),
  }))
  const levels = (levelsResult.data ?? []).map((level) => ({
    id: level.id,
    code: level.code,
    name: level.name,
    sortOrder: level.sort_order,
    grades: grades.filter((grade) => grade.educationLevelId === level.id),
  }))

  return {
    data: {
      id: cycleResult.data.id,
      code: cycleResult.data.code,
      name: cycleResult.data.name,
      startsOn: cycleResult.data.starts_on,
      endsOn: cycleResult.data.ends_on,
      status: cycleResult.data.status,
      levels,
      rates: (ratesResult.data ?? []).flatMap((rate) => {
        const conceptCode = conceptCodes.get(rate.financial_concept_id)
        if (conceptCode !== "TUITION" && conceptCode !== "ENROLLMENT_FEE") return []
        return [{
          id: rate.id,
          educationLevelId: rate.education_level_id,
          financialConceptId: rate.financial_concept_id,
          conceptCode,
          amount: Number(rate.amount),
          validFrom: rate.valid_from,
          validUntil: rate.valid_until,
        }]
      }),
      groups: (groupsResult.data ?? []).map(mapGroup),
    },
    error: false,
  }
}

function mapGroup(group: { id: string; cycle_id: string; grade_level_id: string; code: string; name: string; is_active: boolean }): SchoolCycleGroup {
  return {
    id: group.id,
    cycleId: group.cycle_id,
    gradeLevelId: group.grade_level_id,
    code: group.code,
    name: group.name,
    isActive: group.is_active,
  }
}

function isCycleStatus(value: string): value is SchoolCycle["status"] {
  return value === "PREPARATION" || value === "ACTIVE" || value === "CLOSED"
}
