import type { SupabaseClient } from "@supabase/supabase-js"

export type ConvertiblePreregistration = {
  id: string
  studentId: string
  fullName: string
  studentCode: string | null
  targetCycleId: string
  targetGradeLevelId: string
  campaignName: string | null
  status: "PENDING" | "CONFIRMED"
  notes: string | null
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

export async function getConvertiblePreregistrations(
  supabase: SupabaseClient
): Promise<{ data: ConvertiblePreregistration[]; error: boolean }> {
  const { data, error } = await supabase
    .from("preregistrations")
    .select("id, student_id, target_cycle_id, target_grade_level_id, status, notes, students!inner(full_name, student_code), preregistration_campaigns(name)")
    .in("status", ["PENDING", "CONFIRMED"])
    .order("created_at", { ascending: true })

  if (error) return { data: [], error: true }

  return {
    data: ((data ?? []) as unknown as RecordValue[]).flatMap((preregistration) => {
      const student = record(preregistration.students)
      const campaign = record(preregistration.preregistration_campaigns)
      const status = text(preregistration.status)
      if (
        !student ||
        !text(preregistration.id) ||
        !text(preregistration.student_id) ||
        !text(preregistration.target_cycle_id) ||
        !text(preregistration.target_grade_level_id) ||
        (status !== "PENDING" && status !== "CONFIRMED")
      ) return []

      return [{
        id: text(preregistration.id),
        studentId: text(preregistration.student_id),
        fullName: text(student.full_name),
        studentCode: typeof student.student_code === "string" ? student.student_code : null,
        targetCycleId: text(preregistration.target_cycle_id),
        targetGradeLevelId: text(preregistration.target_grade_level_id),
        campaignName: campaign ? text(campaign.name) || null : null,
        status,
        notes: typeof preregistration.notes === "string" ? preregistration.notes : null,
      }]
    }),
    error: false,
  }
}
