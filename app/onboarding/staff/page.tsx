import { createHash } from 'node:crypto'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getStaffInvitation } from '@/lib/admin/users'
import { createPublicClient } from '@/lib/supabase/server'
import { StaffOnboardingForm } from '@/components/onboarding/staff-onboarding-form'

export default async function StaffOnboardingPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) notFound()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const invitation = await getStaffInvitation(createPublicClient(), tokenHash)
  if (!invitation) return <InvalidInvitation />
  return <main className="flex min-h-dvh items-center justify-center bg-[#f7f7f8] px-5 py-10"><div className="w-full max-w-[360px]"><div className="mb-8 text-center"><div className="mx-auto mb-5 flex size-14 items-center justify-center"><Image src="/logo-real.png" alt="REAL" width={56} height={56} className="size-14 object-contain" priority /></div><h1 className="text-2xl font-semibold tracking-tight">Crea tu acceso a REAL</h1><p className="mt-2 text-sm text-muted-foreground">Hola, {invitation.full_name}. Completa tu registro para acceder como {invitation.role_name}.</p></div><StaffOnboardingForm token={token} initialEmail="" /></div></main>
}

function InvalidInvitation() { return <main className="flex min-h-dvh items-center justify-center bg-[#f7f7f8] px-5"><div className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center"><h1 className="text-xl font-semibold">Invitación no disponible</h1><p className="mt-2 text-sm text-muted-foreground">El enlace expiró, fue revocado o ya fue utilizado.</p></div></main> }
