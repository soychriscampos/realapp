import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminRole = "MASTER" | "ADMINISTRATIVO"

export type CurrentUserProfile = {
  id: string
  displayName: string
  phone: string | null
  email: string | null
  roleLabel: string
}

export async function getCurrentUserProfile(
  supabase: SupabaseClient,
  userId: string,
  roles: AdminRole[],
  email: string | null
): Promise<{ data: CurrentUserProfile | null; error: boolean }> {
  const profileResult = await supabase
    .from("profiles")
    .select("id, display_name, phone")
    .eq("id", userId)
    .maybeSingle()

  if (profileResult.error) {
    console.error("[profile] Failed to load current user profile", {
      userId,
      code: profileResult.error.code,
      message: profileResult.error.message,
      details: profileResult.error.details,
      hint: profileResult.error.hint,
    })
    return { data: null, error: true }
  }

  if (!profileResult.data) {
    console.error("[profile] Current user profile was not found", { userId })
    return { data: null, error: true }
  }

  return {
    data: {
      id: profileResult.data.id,
      displayName: profileResult.data.display_name,
      phone: profileResult.data.phone,
      email,
      roleLabel: roles.includes("MASTER") ? "Master" : "Administrativo",
    },
    error: false,
  }
}
