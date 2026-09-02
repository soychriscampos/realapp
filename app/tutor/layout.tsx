import { requireRole } from '@/lib/auth/require-role'
import { TutorHeader } from '@/components/tutor/tutor-header'
import { createClient } from '@/lib/supabase/server'
import { getTutorGuardian } from '@/app/tutor/data'

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['TUTOR'])
  const supabase = await createClient()
  const { guardian } = await getTutorGuardian(supabase)

  return <div className="min-h-dvh overflow-x-clip bg-[#f7f7f8] text-foreground overscroll-x-none"><TutorHeader name={guardian?.full_name ?? null} />{children}</div>
}
