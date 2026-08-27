"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth/require-role"

export type ProfileMutationResult = { ok: true } | { ok: false; message: string }

export async function updateCurrentUserProfile(input: {
  displayName: string
  phone: string
}): Promise<ProfileMutationResult> {
  const displayName = input.displayName.trim()
  const phone = input.phone.trim()

  if (!displayName) return { ok: false, message: "Indica tu nombre." }

  const { supabase, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, phone: phone || null })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, message: "No pudimos actualizar tus datos. Inténtalo de nuevo." }
  if (!data) return { ok: false, message: "No encontramos tu perfil." }

  revalidatePath("/admin/perfil")
  revalidatePath("/admin")
  return { ok: true }
}
