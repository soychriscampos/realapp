import type { SupabaseClient } from "@supabase/supabase-js"

export type BulkEnrollmentCandidate = {
  studentId: string
  fullName: string
  studentCode: string | null
  previousStatus: string
  previousGrade: {
    id: string
    name: string
    code: string
    isTerminal: boolean
    educationLevelId: string
    educationLevelName: string
    educationLevelCode: string
  }
  previousClassificationId: string
}

export type NoContinuaCandidate = {
  sourceEnrollmentId: string
  studentId: string
  fullName: string
  studentCode: string | null
  previousGrade: { id: string; name: string; educationLevelName: string }
  targetGrade: { id: string; name: string; educationLevelName: string }
}

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export async function getBulkEnrollmentCandidates(
  supabase: SupabaseClient,
  previousCycleId: string,
  currentCycleId: string
): Promise<{ data: BulkEnrollmentCandidate[]; error: boolean }> {
  const [previousEnrollmentsResult, currentEnrollmentsResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, status, students!inner(full_name, student_code), grade_levels!inner(id, name, code, education_level_id, is_terminal, education_levels!inner(name, code)), enrollment_classifications!inner(id)")
      .eq("cycle_id", previousCycleId)
      .not("status", "in", "(BAJA,NO_CONTINUA,EGRESADA)")
      .order("full_name", { referencedTable: "students", ascending: true }),
    supabase
      .from("enrollments")
      .select("student_id")
      .eq("cycle_id", currentCycleId),
  ])

  const currentPreregistrationsResult = await supabase
    .from("preregistrations")
    .select("student_id")
    .eq("target_cycle_id", currentCycleId)
    .in("status", ["PENDING", "CONFIRMED"])

  if (previousEnrollmentsResult.error || currentEnrollmentsResult.error || currentPreregistrationsResult.error) {
    return { data: [], error: true }
  }

  const enrolledCurrentCycle = new Set(
    (currentEnrollmentsResult.data ?? []).flatMap((enrollment) =>
      typeof enrollment.student_id === "string" ? [enrollment.student_id] : []
    )
  )
  const preregisteredForCurrentCycle = new Set(
    (currentPreregistrationsResult.data ?? []).flatMap((preregistration) =>
      typeof preregistration.student_id === "string" ? [preregistration.student_id] : []
    )
  )

  return {
    data: ((previousEnrollmentsResult.data ?? []) as unknown as RecordValue[]).flatMap((enrollment) => {
      const student = record(enrollment.students)
      const grade = record(enrollment.grade_levels)
      const level = record(grade?.education_levels)
      const classification = record(enrollment.enrollment_classifications)
      const studentId = text(enrollment.student_id)
      const previousStatus = text(enrollment.status)

      if (
        !studentId ||
        enrolledCurrentCycle.has(studentId) ||
        (previousStatus === "PREINSCRITA" && !preregisteredForCurrentCycle.has(studentId)) ||
        !student ||
        !grade ||
        !level ||
        !classification
      ) return []

      if (grade?.is_terminal === true && text(level?.code) === "PRIMARIA" && text(grade.code) === "6") return []

      return [{
        studentId,
        fullName: text(student.full_name),
        studentCode: typeof student.student_code === "string" ? student.student_code : null,
        previousStatus,
        previousGrade: {
          id: text(grade.id),
          name: text(grade.name),
          code: text(grade.code),
          isTerminal: grade.is_terminal === true,
          educationLevelId: text(grade.education_level_id),
          educationLevelName: text(level.name),
          educationLevelCode: text(level.code),
        },
        previousClassificationId: text(classification.id),
      }]
    }),
    error: false,
  }
}

export async function getNoContinuaCandidates(
  supabase: SupabaseClient,
  previousCycleId: string,
  targetCycleId: string,
  grades: Array<{ id: string; name: string; education_level_id: string; sort_order: number }>,
  levels: Array<{ id: string; name: string; sort_order: number }>
): Promise<{ data: NoContinuaCandidate[]; error: boolean }> {
  const [previousResult, targetResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, student_id, status, grade_level_id, students!inner(full_name, student_code), grade_levels!inner(id, name, education_level_id, sort_order, education_levels!inner(name))")
      .eq("cycle_id", previousCycleId)
      .eq("status", "FINALIZADA")
      .order("full_name", { referencedTable: "students", ascending: true }),
    supabase.from("enrollments").select("student_id").eq("cycle_id", targetCycleId),
  ])
  if (previousResult.error || targetResult.error) return { data: [], error: true }

  const targetStudentIds = new Set((targetResult.data ?? []).map((row) => row.student_id))
  const orderedGrades = [...grades].sort((left, right) => {
    const leftLevel = levels.find((level) => level.id === left.education_level_id)?.sort_order ?? Number.MAX_SAFE_INTEGER
    const rightLevel = levels.find((level) => level.id === right.education_level_id)?.sort_order ?? Number.MAX_SAFE_INTEGER
    return leftLevel - rightLevel || left.sort_order - right.sort_order
  })

  return {
    data: ((previousResult.data ?? []) as unknown as RecordValue[]).flatMap((row) => {
      const student = record(row.students)
      const previousGrade = record(row.grade_levels)
      const previousLevel = record(previousGrade?.education_levels)
      const studentId = text(row.student_id)
      const index = orderedGrades.findIndex((grade) => grade.id === text(previousGrade?.id))
      const targetGrade = index >= 0 ? orderedGrades[index + 1] : undefined
      const targetLevel = targetGrade ? levels.find((level) => level.id === targetGrade.education_level_id) : undefined
      if (!student || !previousGrade || !previousLevel || !studentId || targetStudentIds.has(studentId) || !targetGrade || !targetLevel) return []
      return [{
        sourceEnrollmentId: text(row.id),
        studentId,
        fullName: text(student.full_name),
        studentCode: typeof student.student_code === "string" ? student.student_code : null,
        previousGrade: { id: text(previousGrade.id), name: text(previousGrade.name), educationLevelName: text(previousLevel.name) },
        targetGrade: { id: targetGrade.id, name: targetGrade.name, educationLevelName: targetLevel.name },
      }]
    }),
    error: false,
  }
}
