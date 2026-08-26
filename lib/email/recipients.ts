import type { SupabaseClient } from "@supabase/supabase-js"

export type StudentEmailRecipient = {
  guardianId: string
  fullName: string
  email: string
  priority: number
}

export async function getStudentEmailRecipients(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ data: StudentEmailRecipient[]; error: boolean }> {
  const { data, error } = await supabase
    .from("student_guardians")
    .select("guardian_id, priority, guardians!inner(full_name, email)")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .eq("via_email", true)
    .not("guardians.email", "is", null)
    .not("guardians.email", "eq", "")
    .order("priority", { ascending: true })

  if (error) return { data: [], error: true }

  return {
    data: (data ?? []).flatMap((row) => {
      const guardian = Array.isArray(row.guardians) ? row.guardians[0] : row.guardians
      const email = typeof guardian?.email === "string" ? guardian.email.trim() : ""
      if (!email || typeof row.guardian_id !== "string") return []

      return [{
        guardianId: row.guardian_id,
        fullName: typeof guardian.full_name === "string" ? guardian.full_name : "",
        email,
        priority: Number(row.priority),
      }]
    }),
    error: false,
  }
}
