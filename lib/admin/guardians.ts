"use server"

import { requireRole } from "@/lib/auth/require-role"

export type GuardianSearchResult = {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  linkedStudents: string[]
}

export async function searchGuardians(query: string): Promise<{ data: GuardianSearchResult[]; error: boolean }> {
  const value = query.trim().replace(/[%,()]/g, " ")
  if (value.length < 2) return { data: [], error: false }
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase
    .from("guardians")
    .select("id, full_name, phone, email, student_guardians(students(full_name))")
    .or(`full_name.ilike.%${value}%,phone.ilike.%${value}%,email.ilike.%${value}%`)
    .order("full_name")
    .limit(20)
  if (error) return { data: [], error: true }
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      linkedStudents: (row.student_guardians ?? []).flatMap((relation: { students: { full_name: string } | { full_name: string }[] | null }) => {
        const student = Array.isArray(relation.students) ? relation.students[0] : relation.students
        return student?.full_name ? [student.full_name] : []
      }),
    })),
    error: false,
  }
}
