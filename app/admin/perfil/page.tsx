import Link from "next/link"

import { ProfileForm } from "@/components/admin/profile-form"
import { getCurrentUserProfile } from "@/lib/admin/profile"
import { requireRole } from "@/lib/auth/require-role"

export default async function ProfilePage() {
  const { supabase, userId, roles, email } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const profileResult = await getCurrentUserProfile(supabase, userId, roles.filter((role): role is "MASTER" | "ADMINISTRATIVO" => role === "MASTER" || role === "ADMINISTRATIVO"), email)

  if (profileResult.error || !profileResult.data) return <ProfileError />

  return <div className="space-y-7"><header><Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Volver a Inicio</Link><h1 className="mt-4 text-[22px] font-semibold tracking-tight sm:text-2xl">Mi perfil</h1><p className="mt-1 text-sm text-muted-foreground">Información de tu cuenta en REAL.</p></header><ProfileForm displayName={profileResult.data.displayName} phone={profileResult.data.phone} email={profileResult.data.email} roleLabel={profileResult.data.roleLabel} /></div>
}

function ProfileError() {
  return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar tu perfil.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/perfil" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div>
}
