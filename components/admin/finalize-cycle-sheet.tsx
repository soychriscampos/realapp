"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CalendarCheck, LoaderCircle, X } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { finalizeActiveEnrollments } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type FinalizeCycleSheetProps = {
  cycle: { id: string; name: string; starts_on: string; ends_on: string }
  activeCount: number
}

export function FinalizeCycleSheet({ cycle, activeCount }: FinalizeCycleSheetProps) {
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
      setError("Selecciona la fecha efectiva de finalización.")
      return
    }

    startTransition(async () => {
      const result = await finalizeActiveEnrollments({ cycleId: cycle.id, effectiveOn })
      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({
        title: "Matrículas finalizadas",
        description: `${result.finalizedCount} matrícula${result.finalizedCount === 1 ? "" : "s"} actualizada${result.finalizedCount === 1 ? "" : "s"}.`,
      })
      close()
      router.refresh()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}>
      <Dialog.Trigger render={<Button variant="outline" disabled={activeCount === 0}><CalendarCheck /> Finalizar ciclo</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div>
              <Dialog.Title className="text-base font-semibold">Finalizar ciclo</Dialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground">Revisión explícita de matrículas activas</p>
            </div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">Esta acción cambiará a FINALIZADA únicamente las matrículas que actualmente están ACTIVA en este ciclo.</p>
              <dl className="divide-y divide-border border-y border-border">
                <Summary label="Ciclo" value={cycle.name} />
                <Summary label="Matrículas a finalizar" value={String(activeCount)} />
                <Summary label="Estados no modificados" value="BAJA, NO_CONTINUA, EGRESADA y FINALIZADA" />
              </dl>
              <label className="grid gap-2 text-sm font-medium">
                <span>Fecha efectiva de finalización</span>
                <Input type="date" min={cycle.starts_on} max={cycle.ends_on} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} />
                <span className="text-xs font-normal text-muted-foreground">Debe estar dentro del ciclo. No se calcula automáticamente.</span>
              </label>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">Las bajas y cualquier otro estado permanecerán sin cambios.</p>
            </section>
          </div>

          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button>
            <Button disabled={isPending || activeCount === 0 || !effectiveOn} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Finalizando..." : "Finalizar matrículas"}</Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>
}
