"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import { Toast } from "@base-ui/react/toast"
import { CalendarCheck, LoaderCircle, X } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { finalizeSelectedEnrollments, graduateSelectedEnrollments } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EnrollmentListItem } from "@/lib/admin/enrollments"

export function BulkEnrollmentActions({ enrollments }: { enrollments: EnrollmentListItem[] }) {
  const [action, setAction] = useState<"finalization" | "graduation" | null>(null)
  const eligibleEnrollments = enrollments.filter((enrollment) =>
    (enrollment.status === "ACTIVA" || enrollment.status === "FINALIZADA") && enrollment.gradeLevel.isTerminal
  )
  if (!enrollments.length) return null

  return (
    <>
      <Menu.Root>
        <Menu.Trigger render={<Button variant="outline" className="h-10">Acciones</Button>} />
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6}>
            <Menu.Popup className="z-50 min-w-52 rounded-xl border border-border bg-white p-1 shadow-lg outline-none">
              <Menu.Item onClick={() => setAction("finalization")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Finalizar seleccionados</Menu.Item>
              {eligibleEnrollments.length > 0 && <Menu.Item onClick={() => setAction("graduation")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Egresar seleccionados</Menu.Item>}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <BulkEnrollmentFinalizationSheet enrollments={enrollments} open={action === "finalization"} onOpenChange={(open) => !open && setAction(null)} showTrigger={false} />
      <BulkEnrollmentGraduationSheet enrollments={eligibleEnrollments} selectedCount={enrollments.length} open={action === "graduation"} onOpenChange={(open) => !open && setAction(null)} />
    </>
  )
}

export function BulkEnrollmentFinalizationSheet({ enrollments, open: controlledOpen, onOpenChange, showTrigger = true }: { enrollments: EnrollmentListItem[]; open?: boolean; onOpenChange?: (open: boolean) => void; showTrigger?: boolean }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  function setOpen(nextOpen: boolean) {
    if (onOpenChange) onOpenChange(nextOpen)
    else setUncontrolledOpen(nextOpen)
  }
  const [effectiveOn, setEffectiveOn] = useState(enrollments[0]?.cycle.endsOn ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()
  const cycle = enrollments[0]?.cycle

  function close() {
    if (isPending) return
    setOpen(false)
    setError(null)
  }

  function submit() {
    if (!cycle || !effectiveOn) {
      setError("Selecciona la fecha efectiva de finalización.")
      return
    }

    startTransition(async () => {
      const result = await finalizeSelectedEnrollments({
        enrollmentIds: enrollments.map((enrollment) => enrollment.id),
        effectiveOn,
      })
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

  if (!enrollments.length || !cycle) return null

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}>
      {showTrigger && <Dialog.Trigger render={<Button variant="outline"><CalendarCheck /> Finalizar matrículas</Button>} />}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div><Dialog.Title className="text-base font-semibold">Finalizar matrículas</Dialog.Title><p className="mt-0.5 text-xs text-muted-foreground">Confirmación de selección</p></div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">Se finalizarán únicamente las matrículas ACTIVA seleccionadas.</p>
              <dl className="divide-y divide-border border-y border-border"><Summary label="Ciclo" value={cycle.name} /><Summary label="Matrículas seleccionadas" value={String(enrollments.length)} /></dl>
              <label className="grid gap-2 text-sm font-medium"><span>Fecha efectiva de finalización</span><Input type="date" min={cycle.startsOn} max={cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Debe estar dentro del ciclo escolar.</span></label>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">No se crearán matrículas nuevas ni se modificarán pagos, cargos o calificaciones.</p>
            </section>
          </div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button><Button disabled={isPending || !effectiveOn} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Finalizando..." : "Confirmar finalización"}</Button></footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function BulkEnrollmentGraduationSheet({ enrollments, selectedCount, open, onOpenChange }: { enrollments: EnrollmentListItem[]; selectedCount: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [effectiveOn, setEffectiveOn] = useState(enrollments[0]?.cycle.endsOn ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()
  const cycle = enrollments[0]?.cycle

  function close() {
    if (isPending) return
    onOpenChange(false)
    setError(null)
  }

  function submit() {
    if (!cycle || !effectiveOn) {
      setError("Selecciona la fecha efectiva de egreso.")
      return
    }

    startTransition(async () => {
      const result = await graduateSelectedEnrollments({
        enrollmentIds: enrollments.map((enrollment) => enrollment.id),
        effectiveOn,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({
        title: "Matrículas egresadas",
        description: `${result.graduatedCount} matrícula${result.graduatedCount === 1 ? "" : "s"} actualizada${result.graduatedCount === 1 ? "" : "s"}.`,
      })
      close()
      router.refresh()
    })
  }

  if (!cycle || !enrollments.length) return null

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div><Dialog.Title className="text-base font-semibold">Egresar seleccionados</Dialog.Title><p className="mt-0.5 text-xs text-muted-foreground">Confirmación de selección</p></div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">Sólo se egresarán las matrículas seleccionadas cuyo grado sea terminal y cuyo estado sea Activa o Finalizada.</p>
              <dl className="divide-y divide-border border-y border-border"><Summary label="Ciclo" value={cycle.name} /><Summary label="Matrículas seleccionadas" value={String(selectedCount)} /><Summary label="Matrículas elegibles" value={String(enrollments.length)} /></dl>
              <label className="grid gap-2 text-sm font-medium"><span>Fecha efectiva de egreso</span><Input type="date" min={cycle.startsOn} max={cycle.endsOn} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Debe estar dentro del ciclo escolar.</span></label>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">Las matrículas no elegibles permanecerán sin cambios. No se modificarán pagos, cargos ni calificaciones.</p>
            </section>
          </div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button><Button disabled={isPending || !effectiveOn} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Egresando..." : "Confirmar egreso"}</Button></footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-12 items-center justify-between gap-4 py-3"><dt className="min-w-0 text-sm text-muted-foreground">{label}</dt><dd className="min-w-0 text-right text-sm font-medium">{value}</dd></div>
}
