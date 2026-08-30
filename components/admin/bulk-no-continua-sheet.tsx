"use client"
import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, LoaderCircle, X } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { markEnrollmentsNoContinua, type NoContinuaResult } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import type { NoContinuaCandidate } from "@/lib/admin/bulk-enrollment"

type Props = { cycle: { id: string; name: string }; previousCycleName: string; candidates: NoContinuaCandidate[]; open: boolean; onOpenChange: (open: boolean) => void }

export function BulkNoContinuaSheet({ cycle, previousCycleName, candidates, open, onOpenChange }: Props) {
  const [results, setResults] = useState<NoContinuaResult[]>([])
  const [submittedCandidates, setSubmittedCandidates] = useState<NoContinuaCandidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()
  const step = results.length ? "results" : "review"
  function close() { if (isPending) return; onOpenChange(false); setError(null); setResults([]) }
  function submit() {
    if (!candidates.length) { setError("No hay alumnos elegibles para marcar como no continúa."); return }
    setSubmittedCandidates(candidates)
    startTransition(async () => {
      const result = await markEnrollmentsNoContinua({ sourceEnrollmentIds: candidates.map((candidate) => candidate.sourceEnrollmentId), targetCycleId: cycle.id })
      if (!result.ok) { setError(result.message); return }
      setResults(result.results)
      const successful = result.results.filter((item) => item.success).length
      toastManager.add({ title: "No continuidad registrada", description: successful + " alumno" + (successful === 1 ? "" : "s") + " procesado" + (successful === 1 ? "" : "s") + "." })
      router.refresh()
    })
  }
  const successful = results.filter((result) => result.success)
  const failed = results.filter((result) => !result.success)
  return <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" /><Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2"><header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6"><div><Dialog.Title className="text-base font-semibold">Marcar como “No continúa”</Dialog.Title>{step === "review" && <p className="mt-0.5 text-xs text-muted-foreground">Revisión y confirmación</p>}</div><Dialog.Close aria-label="Cerrar no continuidad" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close></header><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{step === "review" && <section className="space-y-5"><div><h2 className="text-lg font-semibold">Confirmar no continuidad</h2><p className="mt-1 text-sm text-muted-foreground">Se registrará la decisión para los alumnos seleccionados del ciclo anterior.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Ciclo destino" value={cycle.name} /><Summary label="Alumnos seleccionados" value={String(candidates.length)} /></dl><p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">La matrícula histórica de {previousCycleName} permanecerá intacta. No se generarán cargos ni configuración financiera.</p><div className="overflow-hidden rounded-xl border border-border bg-white">{candidates.map((candidate) => <div key={candidate.sourceEnrollmentId} className="border-b border-border px-4 py-3 last:border-b-0"><p className="text-sm font-medium">{candidate.fullName}</p><p className="mt-1 text-sm text-muted-foreground">{candidate.targetGrade.educationLevelName} {candidate.targetGrade.name} · No continúa</p></div>)}</div></section>}{step === "results" && <section className="space-y-5"><div><CheckCircle2 className="size-9 text-emerald-600" /><h2 className="mt-3 text-lg font-semibold">No continuidad procesada</h2><p className="mt-1 text-sm text-muted-foreground">{successful.length} registrado{successful.length === 1 ? "" : "s"} · {failed.length} con error.</p></div>{failed.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Alumnos con error</h3>{failed.map((result) => <div key={result.studentId} className="border-y border-border px-4 py-3 text-sm text-destructive">{submittedCandidates.find((candidate) => candidate.studentId === result.studentId)?.fullName ?? "Alumno"}: {result.message}</div>)}</div>}</section>}</div>{error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}{step === "review" ? <footer className="flex justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={close}>Cancelar</Button><Button className="h-10" disabled={isPending || !candidates.length} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Registrando..." : "Confirmar"}</Button></footer> : <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button onClick={close}>Cerrar</Button></footer>}</Dialog.Popup></Dialog.Portal></Dialog.Root>
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex min-h-12 items-center justify-between gap-4 py-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-right text-sm font-medium">{value}</dd></div> }
