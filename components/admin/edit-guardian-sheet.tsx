"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { LoaderCircle, Pencil, UserPlus, X } from "lucide-react"
import { useState, useTransition } from "react"

import { addStudentGuardian, updateStudentGuardian } from "@/app/admin/alumnos/[id]/family-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GUARDIAN_RELATIONSHIPS, isGuardianRelationship } from "@/lib/admin/guardian-relationships"
import { GuardianPicker } from "@/components/admin/guardian-picker"
import type { GuardianSearchResult } from "@/lib/admin/guardians"

type Guardian = {
  guardianId: string
  fullName: string
  relationship: string
  phone: string | null
  email: string | null
  viaEmail: boolean
  viaWhatsapp: boolean
}

export function EditGuardianSheet({ studentId, guardian }: { studentId: string; guardian: Guardian }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState(guardian.fullName)
  const [relationship, setRelationship] = useState(guardian.relationship)
  const [relationshipOther, setRelationshipOther] = useState(isGuardianRelationship(guardian.relationship) ? "" : guardian.relationship)
  const [phone, setPhone] = useState(guardian.phone ?? "")
  const [email, setEmail] = useState(guardian.email ?? "")
  const [viaEmail, setViaEmail] = useState(guardian.viaEmail)
  const [viaWhatsapp, setViaWhatsapp] = useState(guardian.viaWhatsapp)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastManager = Toast.useToastManager()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await updateStudentGuardian({
        studentId,
        guardianId: guardian.guardianId,
        fullName,
        relationship: relationship === "Otro" ? relationshipOther : relationship,
        phone,
        email,
        viaEmail,
        viaWhatsapp,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      toastManager.add({ title: "Tutor actualizado", description: "Los datos de contacto fueron guardados." })
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!isPending) setOpen(nextOpen) }}>
      <Dialog.Trigger render={<Button variant="ghost" size="sm" aria-label={`Editar a ${guardian.fullName}`}><Pencil /> Editar</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">Editar tutor</Dialog.Title>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">Datos de contacto y relación</p>
            </div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="space-y-4">
              <Field label="Nombre"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
              <RelationshipField value={relationship} otherValue={relationshipOther} onChange={setRelationship} onOtherChange={setRelationshipOther} />
              <Field label="Teléfono"><Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></Field>
              <Field label="Correo de contacto"><Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></Field>
              <fieldset className="space-y-3 border-t border-border pt-4">
                <legend className="text-sm font-medium">Canales de aviso</legend>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={viaEmail} onChange={(event) => setViaEmail(event.target.checked)} /> Correo electrónico</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={viaWhatsapp} onChange={(event) => setViaWhatsapp(event.target.checked)} /> WhatsApp</label>
              </fieldset>
            </div>
          </div>

          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Dialog.Close render={<Button variant="ghost" disabled={isPending}>Cancelar</Button>} />
            <Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />} {isPending ? "Guardando..." : "Guardar cambios"}</Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AddGuardianSheet({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [relationship, setRelationship] = useState("")
  const [relationshipOther, setRelationshipOther] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [viaEmail, setViaEmail] = useState(true)
  const [viaWhatsapp, setViaWhatsapp] = useState(false)
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastManager = Toast.useToastManager()

  function close() {
    if (!isPending) {
      setOpen(false)
      setError(null)
    }
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await addStudentGuardian({ studentId, guardianId: selectedGuardian?.id, fullName, relationship: relationship === "Otro" ? relationshipOther : relationship, phone, email, viaEmail, viaWhatsapp })
      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      setError(null)
      setFullName("")
      setRelationship("")
      setRelationshipOther("")
      setPhone("")
      setEmail("")
      setViaEmail(true)
      setViaWhatsapp(false)
      setSelectedGuardian(null)
      toastManager.add({ title: "Familiar agregado", description: "El tutor fue vinculado al alumno." })
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!isPending) setOpen(nextOpen) }}>
      <Dialog.Trigger render={<Button variant="outline" size="sm"><UserPlus /> Agregar familiar</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">Agregar familiar</Dialog.Title>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">Datos de contacto y relación</p>
            </div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="space-y-4">
              {!selectedGuardian && <GuardianPicker selected={null} onSelect={(guardian) => { setSelectedGuardian(guardian); setFullName(guardian.fullName); setPhone(guardian.phone ?? ""); setEmail(guardian.email ?? "") }} onClear={() => undefined} />}
              {selectedGuardian ? <><GuardianPicker selected={selectedGuardian} onSelect={setSelectedGuardian} onClear={() => { setSelectedGuardian(null); setFullName(""); setPhone(""); setEmail("") }} /><p className="text-xs text-muted-foreground">Nombre, teléfono y correo son datos canónicos del contacto y no se modifican aquí.</p></> : <Field label="Nombre"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>}
              <RelationshipField value={relationship} otherValue={relationshipOther} onChange={setRelationship} onOtherChange={setRelationshipOther} />
              {!selectedGuardian && <><Field label="Teléfono"><Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></Field><Field label="Correo de contacto"><Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></Field></>}
              <fieldset className="space-y-3 border-t border-border pt-4">
                <legend className="text-sm font-medium">Canales de aviso</legend>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={viaEmail} onChange={(event) => setViaEmail(event.target.checked)} /> Correo electrónico</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={viaWhatsapp} onChange={(event) => setViaWhatsapp(event.target.checked)} /> WhatsApp</label>
              </fieldset>
            </div>
          </div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button>
            <Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />} {isPending ? "Guardando..." : "Guardar familiar"}</Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><Label>{label}</Label>{children}</label>
}

function RelationshipField({ value, otherValue, onChange, onOtherChange }: {
  value: string
  otherValue: string
  onChange: (value: string) => void
  onOtherChange: (value: string) => void
}) {
  const selectedValue = isGuardianRelationship(value) ? value : value ? "Otro" : ""

  return <div className="space-y-2"><Field label="Parentesco"><select value={selectedValue} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"><option value="">Selecciona un parentesco</option>{GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></Field>{selectedValue === "Otro" && <Field label="Especificar parentesco"><Input value={otherValue} onChange={(event) => onOtherChange(event.target.value)} /></Field>}</div>
}
