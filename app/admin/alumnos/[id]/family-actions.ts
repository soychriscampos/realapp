"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth/require-role"

export type UpdateGuardianInput = {
  studentId: string
  guardianId: string
  fullName: string
  relationship: string
  phone: string
  email: string
  viaEmail: boolean
  viaWhatsapp: boolean
}

export type AddGuardianInput = {
  studentId: string
  fullName: string
  relationship: string
  phone: string
  email: string
  viaEmail: boolean
  viaWhatsapp: boolean
}

export async function updateStudentGuardian(input: UpdateGuardianInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const fullName = input.fullName.trim()
  const relationship = input.relationship.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()

  if (!input.studentId || !input.guardianId || !fullName || !relationship) {
    return { ok: false, message: "El nombre y el parentesco son obligatorios." }
  }

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Escribe un correo de contacto válido." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error: guardianError } = await supabase
    .from("guardians")
    .update({ full_name: fullName, phone: phone || null, email: email || null })
    .eq("id", input.guardianId)

  if (guardianError) {
    console.error("updateStudentGuardian guardian", guardianError)
    return { ok: false, message: "No pudimos actualizar los datos del tutor." }
  }

  const { error: relationError } = await supabase
    .from("student_guardians")
    .update({
      relationship,
      via_email: input.viaEmail,
      via_whatsapp: input.viaWhatsapp,
    })
    .eq("student_id", input.studentId)
    .eq("guardian_id", input.guardianId)

  if (relationError) {
    console.error("updateStudentGuardian relation", relationError)
    return { ok: false, message: "No pudimos actualizar la relación del tutor con el alumno." }
  }

  revalidatePath(`/admin/alumnos/${input.studentId}`)
  return { ok: true }
}

export async function addStudentGuardian(input: AddGuardianInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const fullName = input.fullName.trim()
  const relationship = input.relationship.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()

  if (!input.studentId || !fullName || !relationship) {
    return { ok: false, message: "El nombre y el parentesco son obligatorios." }
  }

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Escribe un correo de contacto válido." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: activeRelations, error: relationsError } = await supabase
    .from("student_guardians")
    .select("priority")
    .eq("student_id", input.studentId)
    .eq("is_active", true)

  if (relationsError) {
    console.error("addStudentGuardian relations", relationsError)
    return { ok: false, message: "No pudimos preparar el alta del familiar." }
  }

  const nextPriority = Math.max(0, ...(activeRelations ?? []).map((relation) => relation.priority ?? 0)) + 1
  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .insert({ full_name: fullName, phone: phone || null, email: email || null })
    .select("id")
    .single()

  if (guardianError || !guardian) {
    console.error("addStudentGuardian guardian", guardianError)
    return { ok: false, message: "No pudimos crear el familiar." }
  }

  const { error: relationError } = await supabase
    .from("student_guardians")
    .insert({
      student_id: input.studentId,
      guardian_id: guardian.id,
      relationship,
      priority: nextPriority,
      via_email: input.viaEmail,
      via_whatsapp: input.viaWhatsapp,
    })

  if (relationError) {
    console.error("addStudentGuardian relation", relationError)
    return { ok: false, message: "No pudimos vincular el familiar con el alumno." }
  }

  revalidatePath(`/admin/alumnos/${input.studentId}`)
  return { ok: true }
}
