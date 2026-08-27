import { requireRole } from '@/lib/auth/require-role'
import { AdminShell } from '@/components/admin/admin-shell'
import { getCurrentUserProfile } from '@/lib/admin/profile'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { roles, supabase, userId, email } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const roleLabel = roles.includes('MASTER') ? 'Master' : 'Administrativo'
  const profileResult = await getCurrentUserProfile(supabase, userId, roles.filter((role): role is 'MASTER' | 'ADMINISTRATIVO' => role === 'MASTER' || role === 'ADMINISTRATIVO'), email)
  const userName = profileResult.data?.displayName ?? null

  return <AdminShell roleLabel={roleLabel} userName={userName}>{children}</AdminShell>
}
