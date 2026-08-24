import type { SupabaseClient } from "@supabase/supabase-js"

export type BulkEnrollmentCandidate = {
  studentId: string
  fullName: string
  studentCode: string | null
  previousStatus: string
  previousGrade: {
    id: string
    name: string
    educationLevelId: string
    educationLevelName: string
  }
  previousClassificationId: string
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
      .select("student_id, status, students!inner(full_name, student_code), grade_levels!inner(id, name, education_level_id, education_levels!inner(name)), enrollment_classifications!inner(id)")
      .eq("cycle_id", previousCycleId)
      .order("full_name", { referencedTable: "students", ascending: true }),
    supabase
      .from("enrollments")
      .select("student_id")
      .eq("cycle_id", currentCycleId),
  ])

  if (previousEnrollmentsResult.error || currentEnrollmentsResult.error) {
    return { data: [], error: true }
  }

  const enrolledCurrentCycle = new Set(
    (currentEnrollmentsResult.data ?? []).flatMap((enrollment) =>
      typeof enrollment.student_id === "string" ? [enrollment.student_id] : []
    )
  )

  return {
    data: ((previousEnrollmentsResult.data ?? []) as unknown as RecordValue[]).flatMap((enrollment) => {
      const student = record(enrollment.students)
      const grade = record(enrollment.grade_levels)
      const level = record(grade?.education_levels)
      const classification = record(enrollment.enrollment_classifications)
      const studentId = text(enrollment.student_id)

      if (
        !studentId ||
        enrolledCurrentCycle.has(studentId) ||
        !student ||
        !grade ||
        !level ||
        !classification
      ) return []

      return [{
        studentId,
        fullName: text(student.full_name),
        studentCode: typeof student.student_code === "string" ? student.student_code : null,
        previousStatus: text(enrollment.status),
        previousGrade: {
          id: text(grade.id),
          name: text(grade.name),
          educationLevelId: text(grade.education_level_id),
          educationLevelName: text(level.name),
        },
        previousClassificationId: text(classification.id),
      }]
    }),
    error: false,
  }
}
