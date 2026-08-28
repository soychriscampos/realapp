'use client'

import { Menu } from '@base-ui/react/menu'
import { Ellipsis, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Toast } from '@base-ui/react/toast'
import { regenerateStaffInvitation, revokeStaffInvitation, setStaffAccess } from '@/app/admin/usuarios/actions'
import type { AdminUser } from '@/lib/admin/users'

export function UserActions({ user }: { user: AdminUser }) {
  const [isPending, startTransition] = useTransition(); const [link, setLink] = useState<string | null>(null); const router = useRouter(); const toast = Toast.useToastManager()
  function run(task: () => Promise<{ ok: boolean; message?: string; link?: string }>, success: string) { startTransition(async () => { const result = await task(); if (!result.ok) { toast.add({ title: 'No se pudo completar', description: result.message }); return } if (result.link) { setLink(result.link); await navigator.clipboard.writeText(result.link) } toast.add({ title: success, description: result.link ? 'Enlace copiado.' : undefined }); router.refresh() }) }
  return <><Menu.Root><Menu.Trigger aria-label={`Acciones de ${user.name}`} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Ellipsis className="size-4" /></Menu.Trigger><Menu.Portal><Menu.Positioner align="end"><Menu.Popup className="z-50 min-w-52 rounded-xl border border-border bg-white p-1 shadow-lg">{user.status !== 'ACCESS_ACTIVE' && user.status !== 'ACCESS_INACTIVE' && user.invitationId && <><Menu.Item disabled={isPending} onClick={() => run(() => regenerateStaffInvitation({ invitationId: user.invitationId! }), 'Enlace regenerado')} className="flex h-9 items-center rounded-lg px-2 text-sm hover:bg-muted">Regenerar enlace</Menu.Item><Menu.Item disabled={isPending} onClick={() => run(() => revokeStaffInvitation({ invitationId: user.invitationId! }), 'Invitación revocada')} className="flex h-9 items-center rounded-lg px-2 text-sm hover:bg-muted">Revocar invitación</Menu.Item></>}{user.status === 'ACCESS_ACTIVE' || user.status === 'ACCESS_INACTIVE' ? <Menu.Item disabled={isPending} onClick={() => run(() => setStaffAccess({ userId: user.id, active: user.status === 'ACCESS_INACTIVE' }), user.status === 'ACCESS_ACTIVE' ? 'Acceso desactivado' : 'Acceso reactivado')} className="flex h-9 items-center rounded-lg px-2 text-sm hover:bg-muted">{user.status === 'ACCESS_ACTIVE' ? 'Desactivar acceso' : 'Reactivar acceso'}</Menu.Item> : null}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>{isPending && <LoaderCircle className="size-3 animate-spin text-muted-foreground" aria-label="Procesando" />}{link && <span className="sr-only">{link}</span>}</>
}
