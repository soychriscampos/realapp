"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth/require-role"

export type UpdateStudentBasicsInput = {
  studentId: string
  fullName: string
  birthDate: string
  sex: "H" | "M" | ""
}

export async function updateStudentBasics(input: UpdateStudentBasicsInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const fullName = input.fullName.trim()

  if (!input.studentId || !fullName) {
    return { ok: false, message: "El nombre completo es obligatorio." }
  }

  if (input.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    return { ok: false, message: "Captura una fecha de nacimiento válida." }
  }

  if (input.sex !== "H" && input.sex !== "M" && input.sex !== "") {
    return { ok: false, message: "Selecciona un sexo válido." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase
    .from("students")
    .update({
      full_name: fullName,
      birth_date: input.birthDate || null,
      sex: input.sex || null,
    })
    .eq("id", input.studentId)

  if (error) {
    console.error("updateStudentBasics", error)
    return { ok: false, message: "No pudimos actualizar los datos del alumno." }
  }

  revalidatePath(`/admin/alumnos/${input.studentId}`)
  revalidatePath("/admin/alumnos")
  return { ok: true }
}
