"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, ChevronLeft, LoaderCircle, Search, Users, X } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  bulkCreateAndActivateEnrollments,
  getBulkEnrollmentFeeCoverage,
  type BulkEnrollmentResult,
} from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { BulkEnrollmentCandidate } from "@/lib/admin/bulk-enrollment"
import { getEnrollmentGroupLabel, type EnrollmentFinancialCoverage } from "@/lib/admin/enrollments"
import { getInitialPeriodState } from "@/lib/admin/enrollment-initial-period"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import { defaultGroupId, nextGradeId } from "@/lib/admin/enrollment-destination"

type Cycle = { id: string; name: string; starts_on: string }
type Level = { id: string; name: string; sort_order: number }
type Grade = { id: string; name: string; education_level_id: string; sort_order: number }
type Group = { id: string; name: string; code: string; cycle_id: string; grade_level_id: string }
type Classification = { id: string; name: string }
type Step = "candidates" | "configuration" | "review" | "results"
type CandidateConfiguration = {
  selected: boolean
  gradeLevelId: string
  groupId: string
  classificationId: string
  initialPeriodAmount: string
  discountCategoryId: string
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | "NO_FEE"
  enrollmentFeeAmount: string
}

type BulkEnrollmentActivationSheetProps = {
  cycle: Cycle
  previousCycleName: string
  candidates: BulkEnrollmentCandidate[]
  loadError: boolean
  levels: Level[]
  grades: Grade[]
  groups: Group[]
  classifications: Classification[]
  financialCoverage: EnrollmentFinancialCoverage[]
  discountCategories?: TuitionDiscountCategory[]
}

export function BulkEnrollmentActivationSheet({
  cycle,
  previousCycleName,
  candidates,
  loadError,
  levels,
  grades,
  groups,
  classifications,
  financialCoverage,
  discountCategories = [],
}: BulkEnrollmentActivationSheetProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("candidates")
  const [configurations, setConfigurations] = useState<Record<string, CandidateConfiguration>>({})
  const [query, setQuery] = useState("")
  const [activatedOn, setActivatedOn] = useState(cycle.starts_on)
  const [classesStartOn, setClassesStartOn] = useState(cycle.starts_on)
  const [economicStartOn, setEconomicStartOn] = useState(cycle.starts_on)
  const [initialPeriodDecision, setInitialPeriodDecision] = useState<"WAIVE" | "CHARGE">("WAIVE")
  const [initialPeriodDueDate, setInitialPeriodDueDate] = useState("")
  const [reason, setReason] = useState("")
  const [feeCoverage, setFeeCoverage] = useState<Record<string, boolean> | null>(null)
  const [results, setResults] = useState<BulkEnrollmentResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const contentRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  const selectedCandidates = candidates.filter((candidate) => configurations[candidate.studentId]?.selected)
  const filteredCandidates = candidates.filter((candidate) => normalizeCandidateSearch(candidate).includes(query.trim().toLocaleLowerCase("es-MX")))
  const hasPreOrdinaryPeriod = selectedCandidates.some((candidate) => {
    const configuration = configurations[candidate.studentId]
    return getCandidateInitialPeriodState(configuration, grades, financialCoverage, cycle.id, economicStartOn).isBeforeFirstOrdinaryPeriod
  })
  const initialPeriodChargeSelected = !hasPreOrdinaryPeriod || initialPeriodDecision === "CHARGE"
  useEffect(() => {
    if (!open || step === "results") return
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [open, step])

  function reset() {
    setStep("candidates")
    setQuery("")
    setConfigurations(initialConfigurations(candidates, levels, grades, groups, classifications, cycle.id))
    setActivatedOn(cycle.starts_on)
    setClassesStartOn(cycle.starts_on)
    setEconomicStartOn(cycle.starts_on)
    setInitialPeriodDecision("WAIVE")
    setInitialPeriodDueDate("")
    setReason("")
    setFeeCoverage(null)
    setResults([])
    setError(null)
  }

  function openSheet(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) reset()
  }

  function updateConfiguration(studentId: string, patch: Partial<CandidateConfiguration>) {
    setConfigurations((current) => ({
      ...current,
      [studentId]: { ...current[studentId], ...patch },
    }))
  }

  function continueToConfiguration() {
    if (!selectedCandidates.length) {
      setError("Selecciona al menos un alumno para continuar.")
      return
    }
    startTransition(async () => {
      const coverageResult = await getBulkEnrollmentFeeCoverage({ studentIds: selectedCandidates.map((candidate) => candidate.studentId), cycleId: cycle.id })
      if (!coverageResult.ok) {
        setError(coverageResult.message)
        return
      }
      setFeeCoverage(coverageResult.coverage)
      setError(null)
      setStep("configuration")
    })
  }

  function review() {
    const validationMessage = configurationError(
      selectedCandidates,
      configurations,
      grades,
      cycle,
      groups,
      financialCoverage,
      economicStartOn,
      activatedOn,
      classesStartOn,
      reason,
      initialPeriodChargeSelected
    )
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    if (hasPreOrdinaryPeriod && initialPeriodDecision === "CHARGE" && !isDate(initialPeriodDueDate)) {
      setError("Captura la fecha de vencimiento del tramo previo.")
      return
    }

    startTransition(async () => {
      const coverageResult = await getBulkEnrollmentFeeCoverage({
        studentIds: selectedCandidates.map((candidate) => candidate.studentId),
        cycleId: cycle.id,
      })
      if (!coverageResult.ok) {
        setError(coverageResult.message)
        return
      }
      setFeeCoverage(coverageResult.coverage)
      setError(null)
      setStep("review")
    })
  }

  function submit() {
    if (!feeCoverage) return

    startTransition(async () => {
      const result = await bulkCreateAndActivateEnrollments({
        items: selectedCandidates.map((candidate) => {
          const configuration = configurations[candidate.studentId]
          return {
            studentId: candidate.studentId,
            cycleId: cycle.id,
            gradeLevelId: configuration.gradeLevelId,
            classificationId: configuration.classificationId,
            groupId: configuration.groupId,
            activatedOn,
            classesStartOn: classesStartOn || null,
            economicStartOn: economicStartForRpc(candidate, configuration, grades, financialCoverage, cycle.id, economicStartOn, initialPeriodDecision),
            initialPeriodAmount: needsInitialAmount(candidate, configuration, grades, financialCoverage, cycle.id, economicStartOn) && initialPeriodChargeSelected
              ? configuration.initialPeriodAmount || null
              : null,
            initialPeriodDueDate: getCandidateInitialPeriodState(configuration, grades, financialCoverage, cycle.id, economicStartOn).isBeforeFirstOrdinaryPeriod && initialPeriodChargeSelected ? initialPeriodDueDate || null : null,
            discountCategoryId: configuration.discountCategoryId || null,
            enrollmentFeeMode: feeCoverage[candidate.studentId] ? null : configuration.enrollmentFeeMode,
            enrollmentFeeAmount: feeCoverage[candidate.studentId] || configuration.enrollmentFeeMode !== "PROPORTIONAL" ? null : configuration.enrollmentFeeAmount || null,
            reason,
          }
        }),
      })

      if (!result.ok) {
        setError(result.message)
        setStep("configuration")
        return
      }

      setResults(result.results)
      setError(null)
      setStep("results")
      const successful = result.results.filter((item) => item.success).length
      toastManager.add({
        title: "Activación masiva completada",
        description: `${successful} alumno${successful === 1 ? "" : "s"} activado${successful === 1 ? "" : "s"}.`,
      })
      router.refresh()
    })
  }

  const successfulResults = results.filter((result) => result.success)
  const failedResults = results.filter((result) => !result.success)

  return (
    <Dialog.Root open={open} onOpenChange={openSheet}>
      <Dialog.Trigger
        disabled={!candidates.length && !loadError}
        render={<Button variant="outline" className="h-10"><Users /> Activar alumnos del ciclo anterior</Button>}
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">Activar alumnos del ciclo anterior</Dialog.Title>
              {step !== "results" && <p className="mt-0.5 text-xs text-muted-foreground">{stepLabel(step)}</p>}
            </div>
            <Dialog.Close aria-label="Cerrar activación masiva" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {step === "candidates" && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Alumnos candidatos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Selecciona alumnos con matrícula en {previousCycleName} que aún no están inscritos en {cycle.name}.</p>
                  <div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno..." aria-label="Buscar alumno en la lista" className="h-11 bg-white pl-10" /></div>
                </div>
                {candidates.length ? filteredCandidates.length ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-white">
                    {filteredCandidates.map((candidate) => {
                      const configuration = configurations[candidate.studentId]
                      return <label key={candidate.studentId} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50">
                        <input type="checkbox" checked={configuration?.selected ?? false} onChange={(event) => updateConfiguration(candidate.studentId, { selected: event.target.checked })} className="mt-1 size-4 accent-primary" />
                        <span className="min-w-0"><span className="block truncate text-sm font-medium">{candidate.fullName}</span><span className="mt-1 block text-xs text-muted-foreground">{candidate.studentCode ?? "Sin código"}</span><span className="mt-1 block text-sm text-muted-foreground">{candidate.previousGrade.educationLevelName} {candidate.previousGrade.name} · {statusLabel(candidate.previousStatus)}</span></span>
                      </label>
                    })}
                  </div>
                ) : <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">No encontramos alumnos.</p> : loadError ? <CandidateLoadError /> : <EmptyCandidates />}
              </section>
            )}

            {step === "configuration" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Configuración de continuidad</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Define las fechas una vez y revisa el grupo, grado y clasificación de cada alumno.</p>
                </div>
                <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
                  <Field label="Fecha de activación"><Input type="date" value={activatedOn} onChange={(event) => setActivatedOn(event.target.value)} /></Field>
                  <Field label="Inicio de clases"><Input type="date" value={classesStartOn} onChange={(event) => setClassesStartOn(event.target.value)} /></Field>
                  <Field label="Inicio económico"><Input type="date" value={economicStartOn} onChange={(event) => setEconomicStartOn(event.target.value)} /></Field>
                </div>
                {hasPreOrdinaryPeriod && <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"><p className="text-sm font-medium">Tramo previo al primer periodo ordinario</p><p className="text-sm text-muted-foreground">Elige si genera un cobro antes del primer periodo ordinario.</p><div className="grid gap-2"><Choice label="No cobrarlo" checked={initialPeriodDecision === "WAIVE"} onChange={() => { setInitialPeriodDecision("WAIVE"); setInitialPeriodDueDate("") }} /><Choice label="Cobrarlo" checked={initialPeriodDecision === "CHARGE"} onChange={() => setInitialPeriodDecision("CHARGE")} /></div>{initialPeriodDecision === "CHARGE" && <Field label="Fecha de vencimiento"><Input type="date" value={initialPeriodDueDate} onChange={(event) => setInitialPeriodDueDate(event.target.value)} /></Field>}</div>}
                <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Activación de continuidad para el nuevo ciclo" rows={3} /></Field>
                <div className="space-y-3">
                  <div><h3 className="text-sm font-semibold">Configuración por alumno</h3><p className="mt-1 text-sm text-muted-foreground">El plan predeterminado de 12 pagos se aplicará mediante la activación canónica.</p></div>
                  {selectedCandidates.map((candidate) => {
                    const configuration = configurations[candidate.studentId]
                    const availableGroups = groups.filter((group) => group.cycle_id === cycle.id && group.grade_level_id === configuration.gradeLevelId)
                    const requiresInitialAmount = needsInitialAmount(candidate, configuration, grades, financialCoverage, cycle.id, economicStartOn) && initialPeriodChargeSelected
                    return <article key={candidate.studentId} className="space-y-4 border-y border-border py-4 first:border-t-0">
                      <div><p className="font-medium">{candidate.fullName}</p><p className="mt-1 text-sm text-muted-foreground">Antes: {candidate.previousGrade.educationLevelName} {candidate.previousGrade.name} · {statusLabel(candidate.previousStatus)}</p></div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Grado"><select value={configuration.gradeLevelId} onChange={(event) => updateConfiguration(candidate.studentId, { gradeLevelId: event.target.value, groupId: defaultGroupId(groups, cycle.id, event.target.value) })} className={selectClass}><option value="">Selecciona un grado</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{gradeLabel(grade, levels)}</option>)}</select></Field>
                        <Field label="Grupo"><select value={configuration.groupId} onChange={(event) => updateConfiguration(candidate.studentId, { groupId: event.target.value })} className={selectClass} disabled={!configuration.gradeLevelId}><option value="">Selecciona un grupo</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field>
                        <Field label="Clasificación"><select value={configuration.classificationId} onChange={(event) => updateConfiguration(candidate.studentId, { classificationId: event.target.value })} className={selectClass}><option value="">Selecciona una clasificación</option>{classifications.map((classification) => <option key={classification.id} value={classification.id}>{classification.name}</option>)}</select></Field>
                      </div>
                      {feeCoverage && <div className="grid gap-4 sm:grid-cols-2"><Field label="Descuento"><select value={configuration.discountCategoryId} onChange={(event) => updateConfiguration(candidate.studentId, { discountCategoryId: event.target.value })} className={selectClass}><option value="">Sin descuento</option>{discountCategories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>{feeCoverage[candidate.studentId] ? <div className="text-sm"><span className="block font-medium">Inscripción</span><span className="mt-2 block text-emerald-700">Inscripción cubierta para este ciclo.</span></div> : <div className="space-y-2"><Field label="Inscripción"><select value={configuration.enrollmentFeeMode} onChange={(event) => { const enrollmentFeeMode = event.target.value as CandidateConfiguration["enrollmentFeeMode"]; updateConfiguration(candidate.studentId, { enrollmentFeeMode, enrollmentFeeAmount: enrollmentFeeMode === "PROPORTIONAL" ? configuration.enrollmentFeeAmount : "" }) }} className={selectClass}><option value="FULL">Completa</option><option value="PROPORTIONAL">Proporcional</option><option value="NO_FEE">No paga inscripción</option></select></Field>{configuration.enrollmentFeeMode === "PROPORTIONAL" && <Field label="Importe de inscripción"><Input inputMode="decimal" value={configuration.enrollmentFeeAmount} onChange={(event) => updateConfiguration(candidate.studentId, { enrollmentFeeAmount: event.target.value })} placeholder="0.00" /></Field>}</div>}</div>}
                      {requiresInitialAmount && <div className="rounded-lg border border-border bg-muted/30 p-4"><p className="text-sm font-medium">Primer cobro de ingreso tardío</p><p className="mt-1 text-sm text-muted-foreground">El inicio económico ocurre dentro de un periodo iniciado. Captura el importe acordado; no lo calculamos automáticamente.</p><div className="mt-4 max-w-xs"><Field label="Importe del primer periodo"><Input inputMode="decimal" value={configuration.initialPeriodAmount} onChange={(event) => updateConfiguration(candidate.studentId, { initialPeriodAmount: event.target.value })} placeholder="0.00" /></Field></div></div>}
                    </article>
                  })}
                </div>
              </section>
            )}

            {step === "review" && feeCoverage && (
              <section className="space-y-5">
                <div><h2 className="text-lg font-semibold">Revisar activaciones</h2><p className="mt-1 text-sm text-muted-foreground">Cada alumno se procesará de forma independiente.</p></div>
                <dl className="divide-y divide-border border-y border-border"><Summary label="Ciclo" value={cycle.name} /><Summary label="Fecha de activación" value={formatDate(activatedOn)} /><Summary label="Inicio de clases" value={formatDate(classesStartOn)} /><Summary label="Inicio económico" value={formatDate(economicStartOn)} /><Summary label="Plan" value="12 pagos predeterminado" /><Summary label="Motivo" value={reason} /></dl>
                <div className="overflow-hidden rounded-xl border border-border bg-white">
                  {selectedCandidates.map((candidate) => {
                    const configuration = configurations[candidate.studentId]
                    const grade = grades.find((item) => item.id === configuration.gradeLevelId)
                    const group = groups.find((item) => item.id === configuration.groupId)
                    const classification = classifications.find((item) => item.id === configuration.classificationId)
                    const discountCategory = discountCategories.find((item) => item.id === configuration.discountCategoryId)
                    const initialAmount = needsInitialAmount(candidate, configuration, grades, financialCoverage, cycle.id, economicStartOn) && initialPeriodChargeSelected ? configuration.initialPeriodAmount : null
                    const initialState = getCandidateInitialPeriodState(configuration, grades, financialCoverage, cycle.id, economicStartOn)
                    const initialLabel = initialState.isBeforeFirstOrdinaryPeriod && !initialPeriodChargeSelected ? `Primera colegiatura desde ${formatDate(initialState.firstOrdinaryPeriodStart ?? "")}` : initialAmount ? initialState.isBeforeFirstOrdinaryPeriod ? `Periodo previo acordado: $${initialAmount} · vence ${formatDate(initialPeriodDueDate)}` : `Primer periodo acordado: $${initialAmount}` : "Inicio de periodo · colegiatura vigente"
                    const enrollmentFeeLabel = feeCoverage[candidate.studentId] ? "Inscripción: Cubierta" : configuration.enrollmentFeeMode === "PROPORTIONAL" ? `Inscripción: Proporcional · $${configuration.enrollmentFeeAmount || "0.00"}` : configuration.enrollmentFeeMode === "NO_FEE" ? "Inscripción: No paga" : "Inscripción: Completa"
                    return <div key={candidate.studentId} className="border-b border-border px-4 py-3 last:border-b-0"><p className="font-medium">{candidate.fullName}</p><p className="mt-1 text-sm text-muted-foreground">{grade ? gradeLabel(grade, levels) : ""}{group ? ` · ${getEnrollmentGroupLabel(group)}` : ""} · {classification?.name ?? ""}</p><p className="mt-1 text-sm text-muted-foreground">Beneficio: {discountCategory?.name ?? "Sin beneficio"}</p><p className="mt-1 text-sm text-muted-foreground">{enrollmentFeeLabel}</p><p className="mt-1 text-sm text-muted-foreground">{initialLabel}</p></div>
                  })}
                </div>
              </section>
            )}

            {step === "results" && (
              <section className="space-y-5">
                <div><CheckCircle2 className="size-9 text-emerald-600" /><h2 className="mt-3 text-lg font-semibold">Activación masiva completada</h2><p className="mt-1 text-sm text-muted-foreground">{successfulResults.length} activado{successfulResults.length === 1 ? "" : "s"} correctamente · {failedResults.length} con error.</p></div>
                {failedResults.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Alumnos con error</h3><div className="overflow-hidden rounded-xl border border-border bg-white">{failedResults.map((result) => { const candidate = candidates.find((item) => item.studentId === result.studentId); return <div key={result.studentId} className="border-b border-border px-4 py-3 last:border-b-0"><p className="text-sm font-medium">{candidate?.fullName ?? "Alumno"}</p><p className="mt-1 text-sm text-destructive">{result.message ?? "No pudimos activar esta matrícula."}</p></div> })}</div></div>}
                {successfulResults.length > 0 && <div className="overflow-hidden rounded-xl border border-border bg-white">{successfulResults.map((result) => { const candidate = candidates.find((item) => item.studentId === result.studentId); return <div key={result.studentId} className="border-b border-border px-4 py-3 text-sm last:border-b-0">{candidate?.fullName ?? "Alumno"}</div> })}</div>}
              </section>
            )}
          </div>

          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
          {step !== "results" && <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" className="h-10" disabled={isPending || step === "candidates"} onClick={() => { setError(null); setStep(step === "review" ? "configuration" : "candidates") }}><ChevronLeft /> Atrás</Button>{step === "candidates" ? <Button className="h-10" disabled={!candidates.length} onClick={continueToConfiguration}>Continuar</Button> : step === "configuration" ? <Button className="h-10" disabled={isPending} onClick={review}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Consultando..." : "Revisar"}</Button> : <Button className="h-10" disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Activando..." : "Confirmar activaciones"}</Button>}</footer>}
          {step === "results" && <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close render={<Button className="h-10">Cerrar</Button>} /></footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function initialConfigurations(candidates: BulkEnrollmentCandidate[], levels: Level[], grades: Grade[], groups: Group[], classifications: Classification[], cycleId: string): Record<string, CandidateConfiguration> {
  return Object.fromEntries(candidates.map((candidate) => {
    const gradeLevelId = nextGradeId(candidate.previousGrade.id, grades, levels)
    return [candidate.studentId, {
      selected: false,
      gradeLevelId,
      groupId: defaultGroupId(groups, cycleId, gradeLevelId),
      classificationId: classifications.some((classification) => classification.id === candidate.previousClassificationId)
        ? candidate.previousClassificationId
        : "",
      initialPeriodAmount: "",
      discountCategoryId: "",
      enrollmentFeeMode: "FULL",
      enrollmentFeeAmount: "",
    }]
  }))
}

function needsInitialAmount(candidate: BulkEnrollmentCandidate, configuration: CandidateConfiguration, grades: Grade[], financialCoverage: EnrollmentFinancialCoverage[], cycleId: string, economicStartOn: string) {
  const grade = grades.find((item) => item.id === configuration.gradeLevelId)
  if (!candidate || !grade || !economicStartOn) return false
  return getInitialPeriodState({ financialCoverage, cycleId, educationLevelId: grade.education_level_id, proposedEconomicStartOn: economicStartOn }).needsInitialAmount
}

function getCandidateInitialPeriodState(configuration: CandidateConfiguration, grades: Grade[], financialCoverage: EnrollmentFinancialCoverage[], cycleId: string, economicStartOn: string) {
  const grade = grades.find((item) => item.id === configuration.gradeLevelId)
  return getInitialPeriodState({ financialCoverage, cycleId, educationLevelId: grade?.education_level_id, proposedEconomicStartOn: economicStartOn })
}

function economicStartForRpc(candidate: BulkEnrollmentCandidate, configuration: CandidateConfiguration, grades: Grade[], financialCoverage: EnrollmentFinancialCoverage[], cycleId: string, economicStartOn: string, decision: "WAIVE" | "CHARGE") {
  const state = getCandidateInitialPeriodState(configuration, grades, financialCoverage, cycleId, economicStartOn)
  return state.isBeforeFirstOrdinaryPeriod && decision === "WAIVE"
    ? state.firstOrdinaryPeriodStart ?? economicStartOn
    : economicStartOn
}

function configurationError(candidates: BulkEnrollmentCandidate[], configurations: Record<string, CandidateConfiguration>, grades: Grade[], cycle: Cycle, groups: Group[], financialCoverage: EnrollmentFinancialCoverage[], economicStartOn: string, activatedOn: string, classesStartOn: string, reason: string, initialPeriodChargeSelected: boolean) {
  if (![activatedOn, classesStartOn, economicStartOn].every(isDate)) return "Captura fechas válidas para la activación."
  if (!reason.trim()) return "Indica el motivo de la activación."
  for (const candidate of candidates) {
    const configuration = configurations[candidate.studentId]
    if (!configuration.gradeLevelId || !configuration.groupId || !configuration.classificationId) return `Completa grado, grupo y clasificación para ${candidate.fullName}.`
    if (needsInitialAmount(candidate, configuration, grades, financialCoverage, cycle.id, economicStartOn) && initialPeriodChargeSelected && (!configuration.initialPeriodAmount.trim() || !Number.isFinite(Number(configuration.initialPeriodAmount)) || Number(configuration.initialPeriodAmount) < 0)) return `Captura el importe acordado del primer periodo para ${candidate.fullName}.`
    if (configuration.enrollmentFeeMode === "PROPORTIONAL" && (!configuration.enrollmentFeeAmount.trim() || !Number.isFinite(Number(configuration.enrollmentFeeAmount)) || Number(configuration.enrollmentFeeAmount) <= 0)) return `Captura un importe de inscripción válido para ${candidate.fullName}.`
    if (!groups.some((group) => group.id === configuration.groupId && group.cycle_id === cycle.id && group.grade_level_id === configuration.gradeLevelId)) return `El grupo seleccionado no es válido para ${candidate.fullName}.`
  }
  return null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</Label>
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium"><input type="radio" checked={checked} onChange={onChange} />{label}</label>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>
}

function EmptyCandidates() {
  return <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No hay alumnos pendientes de continuidad.</p><p className="mt-1 text-sm text-muted-foreground">Los alumnos del ciclo anterior ya tienen matrícula en este ciclo.</p></div>
}

function CandidateLoadError() {
  return <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No pudimos cargar los alumnos candidatos.</p><p className="mt-1 text-sm text-muted-foreground">Actualiza la página e inténtalo de nuevo.</p></div>
}

function gradeLabel(grade: Grade, levels: Level[]) {
  const level = levels.find((item) => item.id === grade.education_level_id)
  return `${level?.name ?? ""}${level ? " " : ""}${grade.name}`
}

function statusLabel(status: string) {
  return { ACTIVA: "Activa", BAJA: "Baja", PREINSCRITA: "Preinscrita", PENDIENTE: "Pendiente", NO_CONTINUA: "No continúa" }[status] ?? status
}

function normalizeCandidateSearch(candidate: BulkEnrollmentCandidate) {
  return `${candidate.fullName} ${candidate.studentCode ?? ""}`.toLocaleLowerCase("es-MX")
}

function formatDate(value: string) {
  if (!isDate(value)) return "Sin definir"
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
}

function stepLabel(step: Exclude<Step, "results">) {
  return step === "candidates" ? "1 de 3 · Selección" : step === "configuration" ? "2 de 3 · Configuración" : "3 de 3 · Revisión"
}

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted"
