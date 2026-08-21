import { requireRole } from '@/lib/auth/require-role'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { roles } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const roleLabel = roles.includes('MASTER') ? 'Master' : 'Administrativo'

  return <AdminShell roleLabel={roleLabel}>{children}</AdminShell>
}
