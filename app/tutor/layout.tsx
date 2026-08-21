import { requireRole } from '@/lib/auth/require-role'

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['TUTOR'])

  return children
}
