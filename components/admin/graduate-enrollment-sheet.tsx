"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { GraduationCap, LoaderCircle, X } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { graduateEnrollment } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type GraduateEnrollmentSheetProps = {
  enrollment: {
    id: string
    cycle: { name: string; startsOn: string; endsOn: string }
    student: { fullName: string }
    educationLevel: { name: string }
    gradeLevel: { name: string }
  }
}

export function GraduateEnrollmentSheet({ enrollment }: GraduateEnrollmentSheetProps) {
  const [open, setOpen] = useState(false)
  const [effectiveOn, setEffectiveOn] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  function close() {
    if (isPending) return
    setOpen(false)
    setError(null)
  }

  function submit() {
    if (!effectiveOn) {
      setError("Selecciona la fecha efectiva de egreso.")
      return
    }

    startTransition(async () => {
      const result = await graduateEnrollment({ enrollmentId: enrollment.id, effectiveOn })
      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({ title: "Egreso registrado", description: "La matrícula se marcó como egresada." })
      close()
      router.refresh()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}>
      <Dialog.Trigger render={<Button variant="outline"><GraduationCap /> Marcar como egresado</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div>
              <Dialog.Title className="text-base font-semibold">Marcar como egresado</Dialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground">Confirmación de egreso de matrícula</p>
            </div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-5">
              <dl className="divide-y divide-border border-y border-border">
                <Summary label="Alumno" value={enrollment.student.fullName} />
                <Summary label="Ciclo" value={enrollment.cycle.name} />
                <Summary label="Nivel / grado" value={`${enrollment.educationLevel.name} · ${enrollment.gradeLevel.name}`} />
              </dl>
              <label className="grid gap-2 text-sm font-medium">
                <span>Fecha efectiva de egreso</span>
                <Input type="date" min={enrollment.cycle.startsOn} max={enrollment.cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} />
                <span className="text-xs font-normal text-muted-foreground">Captura la fecha efectiva; no se determina automáticamente.</span>
              </label>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">La matrícula cambiará de FINALIZADA a EGRESADA. No se modificarán cargos, pagos, acuerdos, descuentos, ciclo ni fecha de cierre.</p>
            </section>
          </div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button>
            <Button disabled={isPending || !effectiveOn} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Registrando..." : "Confirmar egreso"}</Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>
}
