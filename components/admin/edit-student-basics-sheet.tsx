"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { LoaderCircle, Pencil, X } from "lucide-react"
import { useState, useTransition } from "react"

import { updateStudentBasics } from "@/app/admin/alumnos/[id]/student-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Student = {
  id: string
  fullName: string
  birthDate: string | null
  sex: string | null
}

export function EditStudentBasicsSheet({ student }: { student: Student }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState(student.fullName)
  const [birthDate, setBirthDate] = useState(student.birthDate ?? "")
  const [sex, setSex] = useState<"H" | "M" | "">(student.sex === "H" || student.sex === "M" ? student.sex : "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastManager = Toast.useToastManager()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await updateStudentBasics({ studentId: student.id, fullName, birthDate, sex })
      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      toastManager.add({ title: "Datos actualizados", description: "Los datos básicos del alumno fueron guardados." })
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!isPending) setOpen(nextOpen) }}>
      <Dialog.Trigger render={<Button variant="ghost" size="sm"><Pencil /> Editar datos</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
            <Dialog.Title className="text-base font-semibold">Editar datos del alumno</Dialog.Title>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="space-y-4">
              <Field label="Nombre completo"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
              <Field label="Fecha de nacimiento"><Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></Field>
              <Field label="Sexo"><select value={sex} onChange={(event) => setSex(event.target.value as "H" | "M" | "")} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"><option value="">Sin especificar</option><option value="H">Hombre</option><option value="M">Mujer</option></select></Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><Label>{label}</Label>{children}</label>
}
