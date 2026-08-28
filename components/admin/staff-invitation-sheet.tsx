'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Toast } from '@base-ui/react/toast'
import { Check, Copy, LoaderCircle, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { createStaffInvitation } from '@/app/admin/usuarios/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function StaffInvitationSheet() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'MASTER' | 'ADMINISTRATIVO'>('ADMINISTRATIVO')
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = Toast.useToastManager()

  function close() {
    if (isPending) return
    setOpen(false); setLink(null); setError(null); setName(''); setCopied(false)
  }

  function submit() {
    if (!name.trim()) return setError('Indica el nombre de la persona.')
    startTransition(async () => {
      const result = await createStaffInvitation({ name, role })
      if (!result.ok) return setError(result.message)
      setLink(result.link ?? null)
      toast.add({ title: 'Invitación creada', description: 'Comparte el enlace con la persona.' })
      router.refresh()
    })
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.add({ title: 'Enlace copiado', description: 'Ya puedes compartirlo.' })
  }

  return <>
    <Button onClick={() => { setOpen(true); setError(null) }} className="h-10"><Plus /> Nueva invitación</Button>
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6"><div><Dialog.Title className="text-base font-semibold">Nueva invitación</Dialog.Title><p className="text-xs text-muted-foreground">El correo se captura al abrir el enlace.</p></div><Dialog.Close disabled={isPending} className="flex size-9 items-center justify-center rounded-lg hover:bg-muted"><X className="size-4" /></Dialog.Close></header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {link ? <section className="space-y-5"><div><h2 className="text-lg font-semibold">Enlace listo para compartir</h2><p className="mt-1 text-sm text-muted-foreground">Este enlace vence en 7 días y sólo puede utilizarse una vez.</p></div><div className="rounded-lg border border-border bg-muted/30 p-3"><p className="break-all text-sm">{link}</p></div><Button onClick={copyLink} variant="outline" className="w-full">{copied ? <Check /> : <Copy />}{copied ? 'Enlace copiado' : 'Copiar enlace'}</Button></section> : <section className="space-y-5"><Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" autoFocus /></Field><Field label="Rol"><select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={selectClass}><option value="ADMINISTRATIVO">Administrativo</option><option value="MASTER">Master</option></select></Field><p className="text-sm text-muted-foreground">No se enviará ningún correo todavía. Comparte manualmente el enlace después de crear la invitación.</p></section>}
          </div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          <footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">{link ? <Button onClick={close}>Cerrar</Button> : <><Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}Crear invitación</Button></>}</footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label> }
const selectClass = 'h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:ring-3 focus:ring-ring/50'
