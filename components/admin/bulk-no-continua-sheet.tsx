"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, ChevronLeft, LoaderCircle, Search, UserRoundCheck, X } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { markEnrollmentsNoContinua, type NoContinuaResult } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { NoContinuaCandidate } from "@/lib/admin/bulk-enrollment"

type Props = {
  cycle: { id: string; name: string }
  previousCycleName: string
  candidates: NoContinuaCandidate[]
  loadError: boolean
}

export function BulkNoContinuaSheet({ cycle, previousCycleName, candidates, loadError }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NoContinuaResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"candidates" | "review" | "results">("candidates")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()
  const selectedCandidates = candidates.filter((candidate) => selectedIds.includes(candidate.sourceEnrollmentId))
  const filteredCandidates = candidates.filter((candidate) => candidate.fullName.toLocaleLowerCase("es-MX").includes(query.trim().toLocaleLowerCase("es-MX")))

  function reset() {
    setSelectedIds([])
    setQuery("")
    setResults([])
    setError(null)
    setStep("candidates")
  }

  function submit() {
    if (!selectedCandidates.length) {
      setError("Selecciona al menos un alumno.")
      return
    }
    startTransition(async () => {
      const result = await markEnrollmentsNoContinua({
        sourceEnrollmentIds: selectedCandidates.map((candidate) => candidate.sourceEnrollmentId),
        targetCycleId: cycle.id,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setResults(result.results)
      setStep("results")
      const successful = result.results.filter((item) => item.success).length
      toastManager.add({
        title: "No continuidad registrada",
        description: `${successful} alumno${successful === 1 ? "" : "s"} procesado${successful === 1 ? "" : "s"}.`,
      })
      router.refresh()
    })
  }

  const successful = results.filter((item) => item.success)
  const failed = results.filter((item) => !item.success)

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) reset() }}>
      <Dialog.Trigger disabled={!candidates.length && !loadError} render={<Button variant="outline" className="h-10"><UserRoundCheck /> Marcar no continúa</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div><Dialog.Title className="text-base font-semibold">Marcar como “No continúa”</Dialog.Title>{step !== "results" && <p className="mt-0.5 text-xs text-muted-foreground">{step === "candidates" ? "1 de 2 · Selección" : "2 de 2 · Confirmación"}</p>}</div>
            <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {step === "candidates" && <section className="space-y-5"><div><h2 className="text-lg font-semibold">Alumnos de {previousCycleName}</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona alumnos con matrícula finalizada que todavía no tienen matrícula en {cycle.name}.</p><div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno..." aria-label="Buscar alumno en la lista" className="h-11 bg-white pl-10" /></div></div>{loadError ? <EmptyState title="No pudimos cargar los candidatos." detail="Actualiza la página e inténtalo de nuevo." /> : candidates.length ? filteredCandidates.length ? <div className="overflow-hidden rounded-xl border border-border bg-white">{filteredCandidates.map((candidate) => <label key={candidate.sourceEnrollmentId} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50"><input type="checkbox" checked={selectedIds.includes(candidate.sourceEnrollmentId)} onChange={() => setSelectedIds((current) => current.includes(candidate.sourceEnrollmentId) ? current.filter((id) => id !== candidate.sourceEnrollmentId) : [...current, candidate.sourceEnrollmentId])} className="mt-1 size-4 accent-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{candidate.fullName}</span><span className="mt-1 block text-sm text-muted-foreground">{candidate.previousGrade.educationLevelName} {candidate.previousGrade.name} → {candidate.targetGrade.educationLevelName} {candidate.targetGrade.name}</span><span className="mt-1 block text-xs text-muted-foreground">Finalizada · sin matrícula en {cycle.name}</span></span></label>)}</div> : <EmptyState title="No encontramos alumnos." detail="Prueba con otro nombre." /> : <EmptyState title="No hay alumnos para marcar." detail="Los alumnos finalizados ya tienen matrícula en el ciclo destino o no tienen un grado proyectado." />}</section>}
            {step === "review" && <section className="space-y-5"><div><h2 className="text-lg font-semibold">Confirmar no continuidad</h2><p className="mt-1 text-sm text-muted-foreground">Se registrará la decisión en el ciclo seleccionado.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Ciclo destino" value={cycle.name} /><Summary label="Alumnos seleccionados" value={String(selectedCandidates.length)} /></dl><p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">La matrícula histórica de {previousCycleName} permanecerá intacta. No se generarán cargos ni configuración financiera.</p><div className="overflow-hidden rounded-xl border border-border bg-white">{selectedCandidates.map((candidate) => <div key={candidate.sourceEnrollmentId} className="border-b border-border px-4 py-3 last:border-b-0"><p className="text-sm font-medium">{candidate.fullName}</p><p className="mt-1 text-sm text-muted-foreground">{candidate.targetGrade.educationLevelName} {candidate.targetGrade.name} · No continúa</p></div>)}</div></section>}
            {step === "results" && <section className="space-y-5"><div><CheckCircle2 className="size-9 text-emerald-600" /><h2 className="mt-3 text-lg font-semibold">No continuidad procesada</h2><p className="mt-1 text-sm text-muted-foreground">{successful.length} registrado{successful.length === 1 ? "" : "s"} · {failed.length} con error.</p></div>{failed.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Alumnos con error</h3>{failed.map((result) => <div key={result.studentId} className="border-y border-border px-4 py-3 text-sm text-destructive">{candidates.find((candidate) => candidate.studentId === result.studentId)?.fullName ?? "Alumno"}: {result.message}</div>)}</div>}</section>}
          </div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          {step !== "results" ? <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending || step === "candidates"} onClick={() => { setError(null); setStep("candidates") }}><ChevronLeft /> Atrás</Button>{step === "candidates" ? <Button disabled={!selectedCandidates.length} onClick={() => { setError(null); setStep("review") }}>Continuar</Button> : <Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Registrando..." : "Confirmar no continuidad"}</Button>}</footer> : <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close render={<Button>Cerrar</Button>} /></footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="flex min-h-12 items-center justify-between gap-4 py-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-right text-sm font-medium">{value}</dd></div> }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div> }
