import { createHash } from "node:crypto"
import Image from "next/image"
import { notFound } from "next/navigation"
import { createPublicClient } from "@/lib/supabase/server"
import { FamilyOnboardingForm } from "@/components/onboarding/family-onboarding-form"

export default async function FamilyOnboardingPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) notFound()
  const { data, error } = await createPublicClient().rpc("get_family_invitation_by_token", { p_token_hash: createHash("sha256").update(token).digest("hex") })
  const invitation = data?.[0]
  if (error || !invitation) return <main className="flex min-h-dvh items-center justify-center bg-[#f7f7f8] px-5"><div className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center"><h1 className="text-xl font-semibold">Invitación no disponible</h1><p className="mt-2 text-sm text-muted-foreground">El enlace expiró, fue revocado o ya fue utilizado.</p></div></main>
  const invitationRows = (data ?? []) as Array<{ student_id: string; student_name: string }>
  const students = invitationRows.map((row) => ({ id: row.student_id, name: row.student_name }))
  return <main className="flex min-h-dvh items-center justify-center bg-[#f7f7f8] px-5 py-10"><div className="w-full max-w-[380px]"><div className="mb-8 text-center"><Image src="/logo-real.png" alt="REAL" width={56} height={56} className="mx-auto mb-5 size-14 object-contain" priority /><h1 className="text-2xl font-semibold tracking-tight">Crea tu acceso familiar</h1><p className="mt-2 text-sm text-muted-foreground">Hola, <strong className="font-semibold">{invitation.guardian_name}</strong>. Podrás consultar a los alumnos autorizados.</p></div><FamilyOnboardingForm token={token} students={students} /></div></main>
}
