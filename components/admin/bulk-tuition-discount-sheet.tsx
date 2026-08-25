"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, ChevronLeft, LoaderCircle, Search, Tags, X } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { bulkSetEnrollmentTuitionDiscount, type BulkTuitionDiscountResult } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import type { BulkTuitionDiscountCandidate } from "@/lib/admin/bulk-tuition-discounts"
import { getEnrollmentGroupLabel } from "@/lib/admin/enrollments"
import { calculateTuitionDiscountPreview, formatCurrency, formatTuitionDiscountValue, tuitionDiscountTypeLabel } from "@/lib/admin/tuition-discount-preview"

type Cycle = { id: string; name: string; starts_on: string }
type Step = "selection" | "review" | "results"
type EffectMode = "CURRENT" | "NEXT" | "PROPORTIONAL"

type BulkTuitionDiscountSheetProps = {
  cycle: Cycle
  candidates: BulkTuitionDiscountCandidate[]
  loadError: boolean
  categories: TuitionDiscountCategory[]
}

export function BulkTuitionDiscountSheet({ cycle, candidates, loadError, categories }: BulkTuitionDiscountSheetProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("selection")
  const [query, setQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({})
  const [bulkCategoryId, setBulkCategoryId] = useState("")
  const [effectiveOn, setEffectiveOn] = useState(cycle.starts_on)
  const [effectMode, setEffectMode] = useState<EffectMode>("CURRENT")
  const [currentPeriodAmounts, setCurrentPeriodAmounts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState("")
  const [results, setResults] = useState<BulkTuitionDiscountResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  const selectedCandidates = candidates.filter((candidate) => selectedIds.includes(candidate.enrollmentId))
  const filteredCandidates = useMemo(() => {
    const term = normalize(query)
    if (!term) return candidates
    return candidates.filter((candidate) => normalize(`${candidate.fullName} ${candidate.studentCode ?? ""}`).includes(term))
  }, [candidates, query])
  const activeCategories = categories.filter((category) => category.isActive)
  const successfulResults = results.filter((result) => result.success)
  const failedResults = results.filter((result) => !result.success)

  function reset() {
    setStep("selection")
    setQuery("")
    setSelectedIds([])
    setCategoryIds({})
    setBulkCategoryId("")
    setEffectiveOn(cycle.starts_on)
    setEffectMode("CURRENT")
    setCurrentPeriodAmounts({})
    setReason("")
    setResults([])
    setError(null)
  }

  function openSheet(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) reset()
  }

  function toggleCandidate(enrollmentId: string, checked: boolean) {
    setSelectedIds((current) => checked ? [...new Set([...current, enrollmentId])] : current.filter((id) => id !== enrollmentId))
    setError(null)
  }

  function applyBulkCategory() {
    if (!bulkCategoryId || !selectedCandidates.length) return
    setCategoryIds((current) => ({
      ...current,
      ...Object.fromEntries(selectedCandidates.map((candidate) => [candidate.enrollmentId, bulkCategoryId])),
    }))
  }

  function review() {
    if (!selectedCandidates.length) {
      setError("Selecciona al menos un alumno para continuar.")
      return
    }
    if (!isDate(effectiveOn)) {
      setError("Captura una fecha efectiva válida.")
      return
    }
    if (!reason.trim()) {
      setError("Indica el motivo del descuento.")
      return
    }
    for (const candidate of selectedCandidates) {
      const category = categoryFor(candidate.enrollmentId, categoryIds, activeCategories)
      if (!category) {
        setError(`Selecciona una categoría para ${candidate.fullName}.`)
        return
      }
      if (!categoryVersion(category, effectiveOn)) {
        setError(`La categoría seleccionada no tiene un valor configurado para la fecha efectiva de ${candidate.fullName}.`)
        return
      }
      if (effectMode === "PROPORTIONAL") {
        const amount = currentPeriodAmounts[candidate.enrollmentId]?.trim() ?? ""
        if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
          setError(`Captura el monto final del periodo actual para ${candidate.fullName}.`)
          return
        }
      }
    }
    setError(null)
    setStep("review")
  }

  function submit() {
    startTransition(async () => {
      const result = await bulkSetEnrollmentTuitionDiscount({
        items: selectedCandidates.map((candidate) => ({
          enrollmentId: candidate.enrollmentId,
          studentId: candidate.studentId,
          categoryId: categoryIds[candidate.enrollmentId],
          currentPeriodAmount: effectMode === "PROPORTIONAL" ? currentPeriodAmounts[candidate.enrollmentId] || null : null,
        })),
        effectiveOn,
        effectMode,
        reason,
      })
      if (!result.ok) {
        setError(result.message)
        setStep("selection")
        return
      }
      setResults(result.results)
      setError(null)
      setStep("results")
      const successful = result.results.filter((item) => item.success).length
      toastManager.add({ title: "Descuentos procesados", description: `${successful} descuento${successful === 1 ? "" : "s"} asignado${successful === 1 ? "" : "s"}.` })
      router.refresh()
    })
  }

  return <Dialog.Root open={open} onOpenChange={openSheet}>
    <Dialog.Trigger disabled={!candidates.length && !loadError} render={<Button variant="outline" className="h-10"><Tags /> Asignar descuentos</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
      <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
        <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6"><div className="min-w-0"><Dialog.Title className="text-base font-semibold">Asignar descuentos</Dialog.Title>{step !== "results" && <p className="mt-0.5 text-xs text-muted-foreground">{step === "selection" ? "1 de 2 · Selección" : "2 de 2 · Revisión"}</p>}</div><Dialog.Close aria-label="Cerrar asignación masiva de descuentos" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close></header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {step === "selection" && (loadError ? <LoadError /> : <section className="space-y-5"><div><h2 className="text-lg font-semibold">Alumnos activos</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona matrículas activas de {cycle.name} y define su categoría de descuento.</p></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o código..." className="h-10 pl-10" /></div><div className="overflow-hidden rounded-xl border border-border bg-white">{filteredCandidates.length ? filteredCandidates.map((candidate) => <CandidateRow key={candidate.enrollmentId} candidate={candidate} checked={selectedIds.includes(candidate.enrollmentId)} onChange={(checked) => toggleCandidate(candidate.enrollmentId, checked)} />) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No encontramos alumnos con esa búsqueda.</p>}</div>{selectedCandidates.length > 0 && <section className="space-y-4 border-y border-border py-5"><div><h3 className="text-sm font-semibold">Aplicar categoría</h3><p className="mt-1 text-sm text-muted-foreground">Puedes aplicar una categoría a todos y ajustarla individualmente antes de confirmar.</p></div><div className="flex flex-col gap-2 sm:flex-row"><select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)} className={selectClass}><option value="">Selecciona una categoría</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Button type="button" variant="outline" onClick={applyBulkCategory} disabled={!bulkCategoryId}>Aplicar a seleccionados</Button></div>{!activeCategories.length && <p className="text-sm text-destructive">No hay categorías activas disponibles para este ciclo.</p>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha efectiva"><Input type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field><Field label="Efecto"><select value={effectMode} onChange={(event) => setEffectMode(event.target.value as EffectMode)} className={selectClass}><option value="CURRENT">Aplicar desde el periodo actual</option><option value="NEXT">Aplicar desde el siguiente periodo</option><option value="PROPORTIONAL">Definir monto final del periodo actual</option></select></Field></div><Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo del descuento" rows={3} /></Field><div className="space-y-3">{selectedCandidates.map((candidate) => <SelectedCandidate key={candidate.enrollmentId} candidate={candidate} categoryId={categoryIds[candidate.enrollmentId] ?? ""} categories={activeCategories} effectiveOn={effectiveOn} effectMode={effectMode} amount={currentPeriodAmounts[candidate.enrollmentId] ?? ""} setCategory={(categoryId) => setCategoryIds((current) => ({ ...current, [candidate.enrollmentId]: categoryId }))} setAmount={(amount) => setCurrentPeriodAmounts((current) => ({ ...current, [candidate.enrollmentId]: amount }))} />)}</div></section>}</section>)}
          {step === "review" && <Review candidates={selectedCandidates} categories={activeCategories} categoryIds={categoryIds} effectiveOn={effectiveOn} effectMode={effectMode} amounts={currentPeriodAmounts} reason={reason} />}
          {step === "results" && <Results successful={successfulResults} failed={failedResults} candidates={candidates} />}
        </div>
        {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
        {step !== "results" && <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" className="h-10" disabled={isPending || step === "selection"} onClick={() => { setError(null); setStep("selection") }}><ChevronLeft /> Atrás</Button>{step === "selection" ? <Button className="h-10" disabled={isPending || !selectedCandidates.length} onClick={review}>Revisar</Button> : <Button className="h-10" disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Asignando..." : "Confirmar descuentos"}</Button>}</footer>}
        {step === "results" && <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close render={<Button className="h-10">Cerrar</Button>} /></footer>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function CandidateRow({ candidate, checked, onChange }: { candidate: BulkTuitionDiscountCandidate; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 accent-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{candidate.fullName}</span><span className="mt-1 block text-xs text-muted-foreground">{candidate.studentCode ?? "Sin código"}</span><span className="mt-1 block text-sm text-muted-foreground">{candidate.levelName} {candidate.gradeName}{candidate.group ? ` · ${getEnrollmentGroupLabel(candidate.group)}` : ""}</span><span className="mt-1 block text-sm text-muted-foreground">{candidate.currentDiscountName ?? "Sin categoría"} · {candidate.agreedAmount === null ? "Sin colegiatura vigente" : formatCurrency(candidate.agreedAmount)}</span></span></label> }

function SelectedCandidate({ candidate, categoryId, categories, effectiveOn, effectMode, amount, setCategory, setAmount }: { candidate: BulkTuitionDiscountCandidate; categoryId: string; categories: TuitionDiscountCategory[]; effectiveOn: string; effectMode: EffectMode; amount: string; setCategory: (value: string) => void; setAmount: (value: string) => void }) { const category = categoryFor(candidate.enrollmentId, { [candidate.enrollmentId]: categoryId }, categories); const version = category ? categoryVersion(category, effectiveOn) : null; const preview = category && version && candidate.baseAmount !== null ? calculateTuitionDiscountPreview(candidate.baseAmount, category.discountType, version.value) : null; return <article className="space-y-3 rounded-lg border border-border p-4"><div><p className="text-sm font-medium">{candidate.fullName}</p><p className="mt-1 text-sm text-muted-foreground">Actual: {candidate.currentDiscountName ?? "Sin categoría"} · {candidate.agreedAmount === null ? "Sin monto individual" : formatCurrency(candidate.agreedAmount)}</p></div><Field label="Categoría"><select value={categoryId} onChange={(event) => setCategory(event.target.value)} className={selectClass}><option value="">Selecciona una categoría</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{category && <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><p className="font-medium">{category.name}</p><p className="mt-1 text-muted-foreground">{tuitionDiscountTypeLabel(category.discountType)}{version ? ` · ${formatTuitionDiscountValue(version.value, category.discountType)}` : " · Sin valor para esta fecha"}</p>{candidate.baseAmount !== null && <p className="mt-1 text-muted-foreground">Base: {formatCurrency(candidate.baseAmount)}{preview ? ` · Estimado: ${formatCurrency(preview.agreedAmount)}` : ""}</p>}</div>}{effectMode === "PROPORTIONAL" && <Field label="Monto final del periodo actual"><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></Field>}</article> }

function Review({ candidates, categories, categoryIds, effectiveOn, effectMode, amounts, reason }: { candidates: BulkTuitionDiscountCandidate[]; categories: TuitionDiscountCategory[]; categoryIds: Record<string, string>; effectiveOn: string; effectMode: EffectMode; amounts: Record<string, string>; reason: string }) { return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar descuentos</h2><p className="mt-1 text-sm text-muted-foreground">Cada descuento se aplicará de forma independiente.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Fecha efectiva" value={formatDate(effectiveOn)} /><Summary label="Efecto" value={effectLabel(effectMode)} /><Summary label="Motivo" value={reason} /></dl><div className="overflow-hidden rounded-xl border border-border bg-white">{candidates.map((candidate) => { const category = categoryFor(candidate.enrollmentId, categoryIds, categories); const version = category ? categoryVersion(category, effectiveOn) : null; const preview = category && version && candidate.baseAmount !== null ? calculateTuitionDiscountPreview(candidate.baseAmount, category.discountType, version.value) : null; return <div key={candidate.enrollmentId} className="border-b border-border px-4 py-3 last:border-b-0"><p className="text-sm font-medium">{candidate.fullName}</p><p className="mt-1 text-sm text-muted-foreground">{category?.name ?? "Sin categoría"}{version ? ` · ${formatTuitionDiscountValue(version.value, category!.discountType)}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">Base: {candidate.baseAmount === null ? "Sin dato" : formatCurrency(candidate.baseAmount)} · Estimado: {preview ? formatCurrency(preview.agreedAmount) : "Sin dato"}</p>{effectMode === "PROPORTIONAL" && <p className="mt-1 text-sm text-muted-foreground">Monto final actual: {formatCurrency(Number(amounts[candidate.enrollmentId]))}</p>}</div> })}</div></section> }

function Results({ successful, failed, candidates }: { successful: BulkTuitionDiscountResult[]; failed: BulkTuitionDiscountResult[]; candidates: BulkTuitionDiscountCandidate[] }) { return <section className="space-y-5"><div><CheckCircle2 className="size-9 text-emerald-600" /><h2 className="mt-3 text-lg font-semibold">Asignación de descuentos completada</h2><p className="mt-1 text-sm text-muted-foreground">{successful.length} descuento{successful.length === 1 ? "" : "s"} asignado{successful.length === 1 ? "" : "s"} · {failed.length} con error.</p></div>{failed.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Alumnos con error</h3><div className="overflow-hidden rounded-xl border border-border bg-white">{failed.map((result) => <div key={result.studentId} className="border-b border-border px-4 py-3 last:border-b-0"><p className="text-sm font-medium">{candidates.find((candidate) => candidate.studentId === result.studentId)?.fullName ?? "Alumno"}</p><p className="mt-1 text-sm text-destructive">{result.message ?? "No pudimos asignar el descuento."}</p></div>)}</div></div>}</section> }

function LoadError() { return <section className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No pudimos cargar las matrículas activas.</p><p className="mt-1 text-sm text-muted-foreground">Actualiza la página e inténtalo de nuevo.</p></section> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</Label> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd></div> }
function categoryFor(enrollmentId: string, categoryIds: Record<string, string>, categories: TuitionDiscountCategory[]) { return categories.find((category) => category.id === categoryIds[enrollmentId]) ?? null }
function categoryVersion(category: TuitionDiscountCategory, effectiveOn: string) { return category.versions.filter((version) => version.validFrom <= effectiveOn && (!version.validUntil || version.validUntil >= effectiveOn)).sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0] ?? null }
function effectLabel(mode: EffectMode) { return mode === "CURRENT" ? "Periodo actual" : mode === "NEXT" ? "Siguiente periodo" : "Monto final del periodo actual" }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) }
const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
