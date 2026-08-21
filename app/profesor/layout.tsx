import { requireRole } from '@/lib/auth/require-role'

export default async function ProfesorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['PROFESOR'])

  return children
}
