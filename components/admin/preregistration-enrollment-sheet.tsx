"use client"

import { Dialog } from "@base-ui/react/dialog"
import { CheckCircle2, ChevronLeft, LoaderCircle, UsersRound, X } from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { getEnrollmentFeeCoverage, resolvePreregistrationToEnrollment } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getEnrollmentGroupLabel, type EnrollmentFinancialCoverage } from "@/lib/admin/enrollments"
import { getInitialPeriodState } from "@/lib/admin/enrollment-initial-period"
import type { ConvertiblePreregistration } from "@/lib/admin/preregistrations"

type Cycle = { id: string; name: string; starts_on: string }
type Grade = { id: string; name: string; education_level_id: string }
type Level = { id: string; name: string }
type Group = { id: string; name: string; code: string; cycle_id: string; grade_level_id: string }
type Classification = { id: string; name: string }
type Step = "list" | "activation" | "review" | "success"
type FeeCoverage = "idle" | "loading" | "covered" | "uncovered" | "error"

type PreregistrationEnrollmentSheetProps = {
  preregistrations: ConvertiblePreregistration[]
  loadError: boolean
  cycles: Cycle[]
  levels: Level[]
  grades: Grade[]
  groups: Group[]
  classifications: Classification[]
  financialCoverage: EnrollmentFinancialCoverage[]
}

export function PreregistrationEnrollmentSheet({
  preregistrations,
  loadError,
  cycles,
  levels,
  grades,
  groups,
  classifications,
  financialCoverage,
}: PreregistrationEnrollmentSheetProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("list")
  const [selected, setSelected] = useState<ConvertiblePreregistration | null>(null)
  const [groupId, setGroupId] = useState("")
  const [classificationId, setClassificationId] = useState("")
  const [activatedOn, setActivatedOn] = useState("")
  const [classesStartOn, setClassesStartOn] = useState("")
  const [economicStartOn, setEconomicStartOn] = useState("")
  const [initialPeriodAmount, setInitialPeriodAmount] = useState("")
  const [initialPeriodDueDate, setInitialPeriodDueDate] = useState("")
  const [initialPeriodDecision, setInitialPeriodDecision] = useState<"WAIVE" | "CHARGE">("WAIVE")
  const [feeCoverage, setFeeCoverage] = useState<FeeCoverage>("idle")
  const [enrollmentFeeMode, setEnrollmentFeeMode] = useState<"FULL" | "PROPORTIONAL">("FULL")
  const [enrollmentFeeAmount, setEnrollmentFeeAmount] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const targetCycle = cycles.find((cycle) => cycle.id === selected?.targetCycleId) ?? null
  const targetGrade = grades.find((grade) => grade.id === selected?.targetGradeLevelId) ?? null
  const targetLevel = levels.find((level) => level.id === targetGrade?.education_level_id) ?? null
  const availableGroups = groups.filter((group) => group.cycle_id === selected?.targetCycleId && group.grade_level_id === selected?.targetGradeLevelId)
  const selectedGroup = availableGroups.find((group) => group.id === groupId) ?? null
  const selectedClassification = classifications.find((classification) => classification.id === classificationId) ?? null
  const initialPeriodState = getInitialPeriodState({
    financialCoverage,
    cycleId: selected?.targetCycleId ?? "",
    educationLevelId: targetGrade?.education_level_id,
    proposedEconomicStartOn: economicStartOn,
  })
  const showInitialPeriodDecision = initialPeriodState.isBeforeFirstOrdinaryPeriod
  const needsInitialAmount = initialPeriodState.needsInitialAmount
  const initialPeriodChargeSelected = !showInitialPeriodDecision || initialPeriodDecision === "CHARGE"
  const economicStartForRpc = showInitialPeriodDecision && initialPeriodDecision === "WAIVE"
    ? initialPeriodState.firstOrdinaryPeriodStart ?? economicStartOn
    : economicStartOn

  function reset() {
    setStep("list")
    setSelected(null)
    setGroupId("")
    setClassificationId("")
    setActivatedOn("")
    setClassesStartOn("")
    setEconomicStartOn("")
    setInitialPeriodAmount("")
    setInitialPeriodDueDate("")
    setInitialPeriodDecision("WAIVE")
    setFeeCoverage("idle")
    setEnrollmentFeeMode("FULL")
    setEnrollmentFeeAmount("")
    setReason("")
    setError(null)
    setSuccessId(null)
  }

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) reset()
  }

  async function selectPreregistration(preregistration: ConvertiblePreregistration) {
    const cycle = cycles.find((item) => item.id === preregistration.targetCycleId)
    const defaults = cycle?.starts_on ?? ""
    setSelected(preregistration)
    setGroupId("")
    setClassificationId("")
    setActivatedOn(defaults)
    setClassesStartOn(defaults)
    setEconomicStartOn(defaults)
    setInitialPeriodAmount("")
    setInitialPeriodDueDate("")
    setEnrollmentFeeMode("FULL")
    setEnrollmentFeeAmount("")
    setReason("")
    setError(null)
    setFeeCoverage("loading")
    setStep("activation")

    const result = await getEnrollmentFeeCoverage({ studentId: preregistration.studentId, cycleId: preregistration.targetCycleId })
    setFeeCoverage(result.ok ? result.covered ? "covered" : "uncovered" : "error")
    if (!result.ok) setError(result.message)
  }

  function review() {
    const validationMessage = formError()
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    setError(null)
    setStep("review")
  }

  function submit() {
    if (!selected) return
    startTransition(async () => {
      const result = await resolvePreregistrationToEnrollment({
        preregistrationId: selected.id,
        studentId: selected.studentId,
        classificationId,
        groupId,
        activatedOn,
        classesStartOn,
        economicStartOn: economicStartForRpc,
        initialPeriodAmount: needsInitialAmount && initialPeriodChargeSelected ? initialPeriodAmount || null : null,
        initialPeriodDueDate: needsInitialAmount && initialPeriodChargeSelected ? initialPeriodDueDate || null : null,
        enrollmentFeeMode: feeCoverage === "uncovered" ? enrollmentFeeMode : null,
        enrollmentFeeAmount: feeCoverage === "uncovered" && enrollmentFeeMode === "PROPORTIONAL" ? enrollmentFeeAmount || null : null,
        reason,
      })
      if (!result.ok) {
        setError(result.message)
        setStep("activation")
        return
      }
      setSuccessId(result.enrollmentId)
      setError(null)
      setStep("success")
      router.refresh()
    })
  }

  function formError() {
    if (!selected || !targetCycle || !targetGrade) return "Selecciona una preinscripción válida."
    if (!groupId || !classificationId) return "Selecciona grupo y clasificación para activar la matrícula."
    if (![activatedOn, classesStartOn, economicStartOn].every(isDate)) return "Captura fechas válidas para la activación."
    if (needsInitialAmount && initialPeriodChargeSelected && (!initialPeriodAmount.trim() || !isAmount(initialPeriodAmount))) return "Captura el importe acordado para el primer periodo."
    if (showInitialPeriodDecision && initialPeriodChargeSelected && !initialPeriodDueDate.trim()) return "Captura la fecha de vencimiento del tramo previo."
    if (needsInitialAmount && initialPeriodDueDate && !isDate(initialPeriodDueDate)) return "Captura una fecha válida para el primer cobro."
    if (feeCoverage === "idle" || feeCoverage === "loading") return "Espera a que confirmemos el estado de la inscripción."
    if (feeCoverage === "error") return "No pudimos consultar si la inscripción está cubierta. Inténtalo de nuevo."
    if (feeCoverage === "uncovered" && enrollmentFeeMode === "PROPORTIONAL" && (!enrollmentFeeAmount.trim() || !isAmount(enrollmentFeeAmount))) return "Captura un importe válido para la inscripción proporcional."
    if (!reason.trim()) return "Indica el motivo de la matrícula."
    return null
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger disabled={!preregistrations.length && !loadError} render={<Button variant="outline" className="h-10"><UsersRound /> Preinscritos</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
      <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
        <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6"><div className="min-w-0"><Dialog.Title className="text-base font-semibold">Preinscritos</Dialog.Title>{step !== "success" && <p className="mt-0.5 text-xs text-muted-foreground">{stepLabel(step)}</p>}</div><Dialog.Close aria-label="Cerrar preinscritos" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close></header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {step === "list" && (loadError ? <LoadError /> : <PreregistrationList preregistrations={preregistrations} cycles={cycles} grades={grades} levels={levels} onSelect={selectPreregistration} />)}
          {step === "activation" && selected && <ActivationForm preregistration={selected} targetCycle={targetCycle} targetGrade={targetGrade} targetLevel={targetLevel} groups={availableGroups} classifications={classifications} groupId={groupId} setGroupId={setGroupId} classificationId={classificationId} setClassificationId={setClassificationId} activatedOn={activatedOn} setActivatedOn={setActivatedOn} classesStartOn={classesStartOn} setClassesStartOn={setClassesStartOn} economicStartOn={economicStartOn} setEconomicStartOn={setEconomicStartOn} showInitialPeriodDecision={showInitialPeriodDecision} initialPeriodDecision={initialPeriodDecision} setInitialPeriodDecision={setInitialPeriodDecision} firstOrdinaryPeriodStart={initialPeriodState.firstOrdinaryPeriodStart} initialPeriodChargeSelected={initialPeriodChargeSelected} needsInitialAmount={needsInitialAmount} initialPeriodAmount={initialPeriodAmount} setInitialPeriodAmount={setInitialPeriodAmount} initialPeriodDueDate={initialPeriodDueDate} setInitialPeriodDueDate={setInitialPeriodDueDate} feeCoverage={feeCoverage} enrollmentFeeMode={enrollmentFeeMode} setEnrollmentFeeMode={setEnrollmentFeeMode} enrollmentFeeAmount={enrollmentFeeAmount} setEnrollmentFeeAmount={setEnrollmentFeeAmount} reason={reason} setReason={setReason} />}
          {step === "review" && selected && <Review preregistration={selected} cycle={targetCycle} grade={targetGrade} level={targetLevel} group={selectedGroup} classification={selectedClassification} activatedOn={activatedOn} classesStartOn={classesStartOn} economicStartOn={economicStartForRpc} showInitialPeriodDecision={showInitialPeriodDecision} initialPeriodChargeSelected={initialPeriodChargeSelected} firstOrdinaryPeriodStart={initialPeriodState.firstOrdinaryPeriodStart} needsInitialAmount={needsInitialAmount} initialPeriodAmount={initialPeriodAmount} initialPeriodDueDate={initialPeriodDueDate} feeCoverage={feeCoverage} enrollmentFeeMode={enrollmentFeeMode} enrollmentFeeAmount={enrollmentFeeAmount} reason={reason} />}
          {step === "success" && selected && <section className="py-8 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h2 className="mt-4 text-lg font-semibold">Preinscripción convertida</h2><p className="mt-2 text-sm text-muted-foreground">{selected.fullName} ya tiene una matrícula activa para el ciclo destino.</p>{successId && <p className="mt-1 text-xs text-muted-foreground">La preinscripción quedó resuelta.</p>}</section>}
        </div>
        {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
        {step !== "success" && <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" className="h-10" disabled={isPending || step === "list"} onClick={() => { setError(null); setStep(step === "review" ? "activation" : "list") }}><ChevronLeft /> Atrás</Button>{step === "review" ? <Button className="h-10" disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Convirtiendo..." : "Confirmar matrícula"}</Button> : <Button className="h-10" disabled={step === "list" || isPending} onClick={review}>Revisar</Button>}</footer>}
        {step === "success" && <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close render={<Button className="h-10">Cerrar</Button>} /></footer>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function PreregistrationList({ preregistrations, cycles, grades, levels, onSelect }: { preregistrations: ConvertiblePreregistration[]; cycles: Cycle[]; grades: Grade[]; levels: Level[]; onSelect: (preregistration: ConvertiblePreregistration) => void }) {
  if (!preregistrations.length) return <section className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No hay preinscripciones pendientes por convertir.</p><p className="mt-1 text-sm text-muted-foreground">Las preinscripciones canceladas o resueltas no aparecen aquí.</p></section>
  return <section className="space-y-4"><div><h2 className="text-lg font-semibold">Preinscripciones convertibles</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona una preinscripción pendiente o confirmada para activar su matrícula.</p></div><div className="overflow-hidden rounded-xl border border-border bg-white">{preregistrations.map((preregistration) => { const cycle = cycles.find((item) => item.id === preregistration.targetCycleId); const grade = grades.find((item) => item.id === preregistration.targetGradeLevelId); const level = levels.find((item) => item.id === grade?.education_level_id); return <button key={preregistration.id} type="button" onClick={() => onSelect(preregistration)} className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span className="block text-sm font-medium">{preregistration.fullName}</span><span className="mt-1 block text-xs text-muted-foreground">{preregistration.studentCode ?? "Sin código"}</span><span className="mt-1 block text-sm text-muted-foreground">{cycle?.name ?? "Ciclo destino"} · {level?.name ?? ""} {grade?.name ?? ""}</span><span className="mt-1 block text-sm text-muted-foreground">{statusLabel(preregistration.status)}{preregistration.campaignName ? ` · ${preregistration.campaignName}` : ""}</span>{preregistration.notes && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{preregistration.notes}</span>}</button> })}</div></section>
}

function ActivationForm({ preregistration, targetCycle, targetGrade, targetLevel, groups, classifications, groupId, setGroupId, classificationId, setClassificationId, activatedOn, setActivatedOn, classesStartOn, setClassesStartOn, economicStartOn, setEconomicStartOn, showInitialPeriodDecision, initialPeriodDecision, setInitialPeriodDecision, firstOrdinaryPeriodStart, initialPeriodChargeSelected, needsInitialAmount, initialPeriodAmount, setInitialPeriodAmount, initialPeriodDueDate, setInitialPeriodDueDate, feeCoverage, enrollmentFeeMode, setEnrollmentFeeMode, enrollmentFeeAmount, setEnrollmentFeeAmount, reason, setReason }: { preregistration: ConvertiblePreregistration; targetCycle: Cycle | null; targetGrade: Grade | null; targetLevel: Level | null; groups: Group[]; classifications: Classification[]; groupId: string; setGroupId: (value: string) => void; classificationId: string; setClassificationId: (value: string) => void; activatedOn: string; setActivatedOn: (value: string) => void; classesStartOn: string; setClassesStartOn: (value: string) => void; economicStartOn: string; setEconomicStartOn: (value: string) => void; showInitialPeriodDecision: boolean; initialPeriodDecision: "WAIVE" | "CHARGE"; setInitialPeriodDecision: (value: "WAIVE" | "CHARGE") => void; firstOrdinaryPeriodStart: string | null; initialPeriodChargeSelected: boolean; needsInitialAmount: boolean; initialPeriodAmount: string; setInitialPeriodAmount: (value: string) => void; initialPeriodDueDate: string; setInitialPeriodDueDate: (value: string) => void; feeCoverage: FeeCoverage; enrollmentFeeMode: "FULL" | "PROPORTIONAL"; setEnrollmentFeeMode: (value: "FULL" | "PROPORTIONAL") => void; enrollmentFeeAmount: string; setEnrollmentFeeAmount: (value: string) => void; reason: string; setReason: (value: string) => void }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Activar matrícula</h2><p className="mt-1 text-sm text-muted-foreground">El alumno, ciclo y grado vienen definidos por la preinscripción.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={preregistration.fullName} /><Summary label="Ciclo destino" value={targetCycle?.name ?? ""} /><Summary label="Grado destino" value={`${targetLevel?.name ?? ""}${targetLevel ? " " : ""}${targetGrade?.name ?? ""}`} /><Summary label="Campaña" value={preregistration.campaignName ?? "Sin campaña"} /></dl><div className="grid gap-4 sm:grid-cols-2"><Field label="Grupo"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={selectClass}><option value="">Selecciona un grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field><Field label="Clasificación"><select value={classificationId} onChange={(event) => setClassificationId(event.target.value)} className={selectClass}><option value="">Selecciona una clasificación</option>{classifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Fecha de activación"><Input type="date" value={activatedOn} onChange={(event) => setActivatedOn(event.target.value)} /></Field><Field label="Inicio de clases"><Input type="date" value={classesStartOn} onChange={(event) => setClassesStartOn(event.target.value)} /></Field><Field label="Inicio económico"><Input type="date" value={economicStartOn} onChange={(event) => setEconomicStartOn(event.target.value)} /></Field></div>{needsInitialAmount && <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">{showInitialPeriodDecision && <><p className="text-sm font-medium">Tramo previo al primer periodo ordinario</p><p className="mt-1 text-sm text-muted-foreground">Elige si genera un cobro antes de {firstOrdinaryPeriodStart}.</p><div className="grid gap-2"><Choice label="No cobrarlo" checked={initialPeriodDecision === "WAIVE"} onChange={() => setInitialPeriodDecision("WAIVE")} /><Choice label="Cobrarlo" checked={initialPeriodDecision === "CHARGE"} onChange={() => setInitialPeriodDecision("CHARGE")} /></div></>}{initialPeriodChargeSelected && <div className="grid gap-4 sm:grid-cols-2"><Field label="Importe del primer periodo"><Input inputMode="decimal" value={initialPeriodAmount} onChange={(event) => setInitialPeriodAmount(event.target.value)} placeholder="0.00" /></Field><Field label="Fecha de vencimiento"><Input type="date" value={initialPeriodDueDate} onChange={(event) => setInitialPeriodDueDate(event.target.value)} /></Field></div>}</div>}<section className="space-y-3 border-y border-border py-4"><div><h3 className="text-sm font-semibold">Inscripción</h3>{(feeCoverage === "idle" || feeCoverage === "loading") && <p className="mt-1 text-sm text-muted-foreground">Consultando cobertura de inscripción...</p>}{feeCoverage === "covered" && <p className="mt-1 text-sm text-emerald-700">Inscripción cubierta para este ciclo.</p>}{feeCoverage === "uncovered" && <p className="mt-1 text-sm text-muted-foreground">Debe generar inscripción.</p>}{feeCoverage === "error" && <p className="mt-1 text-sm text-destructive">No pudimos consultar la cobertura de inscripción.</p>}</div>{feeCoverage === "uncovered" && <><div className="grid gap-2"><Choice label="Completa" checked={enrollmentFeeMode === "FULL"} onChange={() => setEnrollmentFeeMode("FULL")} /><Choice label="Proporcional" checked={enrollmentFeeMode === "PROPORTIONAL"} onChange={() => setEnrollmentFeeMode("PROPORTIONAL")} /></div>{enrollmentFeeMode === "PROPORTIONAL" && <Field label="Importe de inscripción"><Input inputMode="decimal" value={enrollmentFeeAmount} onChange={(event) => setEnrollmentFeeAmount(event.target.value)} placeholder="0.00" /></Field>}</>}</section><Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo de la activación" rows={3} /></Field></section>
}

function Review({ preregistration, cycle, grade, level, group, classification, activatedOn, classesStartOn, economicStartOn, showInitialPeriodDecision, initialPeriodChargeSelected, firstOrdinaryPeriodStart, needsInitialAmount, initialPeriodAmount, initialPeriodDueDate, feeCoverage, enrollmentFeeMode, enrollmentFeeAmount, reason }: { preregistration: ConvertiblePreregistration; cycle: Cycle | null; grade: Grade | null; level: Level | null; group: Group | null; classification: Classification | null; activatedOn: string; classesStartOn: string; economicStartOn: string; showInitialPeriodDecision: boolean; initialPeriodChargeSelected: boolean; firstOrdinaryPeriodStart: string | null; needsInitialAmount: boolean; initialPeriodAmount: string; initialPeriodDueDate: string; feeCoverage: FeeCoverage; enrollmentFeeMode: "FULL" | "PROPORTIONAL"; enrollmentFeeAmount: string; reason: string }) { const fee = feeCoverage === "covered" ? "Inscripción cubierta para este ciclo" : enrollmentFeeMode === "PROPORTIONAL" ? `Inscripción proporcional · $${enrollmentFeeAmount}` : "Inscripción completa"; const initial = !needsInitialAmount ? "Inicio de periodo · colegiatura vigente" : !initialPeriodChargeSelected ? `Primera colegiatura desde ${formatDate(firstOrdinaryPeriodStart ?? "")}` : showInitialPeriodDecision ? `Periodo previo · $${initialPeriodAmount} acordado · vence ${formatDate(initialPeriodDueDate)}` : `$${initialPeriodAmount} acordado`; return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Revisar matrícula</h2><p className="mt-1 text-sm text-muted-foreground">La preinscripción se resolverá solo si la activación se completa correctamente.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={preregistration.fullName} /><Summary label="Ciclo" value={cycle?.name ?? ""} /><Summary label="Grado" value={`${level?.name ?? ""}${level ? " " : ""}${grade?.name ?? ""}${group ? ` · ${getEnrollmentGroupLabel(group)}` : ""}`} /><Summary label="Clasificación" value={classification?.name ?? ""} /><Summary label="Fecha de activación" value={formatDate(activatedOn)} /><Summary label="Inicio de clases" value={formatDate(classesStartOn)} /><Summary label="Inicio económico" value={formatDate(economicStartOn)} /><Summary label="Colegiatura inicial" value={initial} /><Summary label="Inscripción" value={fee} /><Summary label="Motivo" value={reason} /></dl></section> }

function LoadError() { return <section className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No pudimos cargar las preinscripciones.</p><p className="mt-1 text-sm text-muted-foreground">Actualiza la página e inténtalo de nuevo.</p></section> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</Label> }
function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium"><input type="radio" checked={checked} onChange={onChange} />{label}</label> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || "Sin dato"}</dd></div> }
function stepLabel(step: Exclude<Step, "success">) { return step === "list" ? "1 de 3 · Preinscripción" : step === "activation" ? "2 de 3 · Activación" : "3 de 3 · Revisión" }
function statusLabel(status: ConvertiblePreregistration["status"]) { return status === "PENDING" ? "Pendiente" : "Confirmada" }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) }
function isAmount(value: string) { return Number.isFinite(Number(value)) && Number(value) >= 0 }
function formatDate(value: string) { return isDate(value) ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Sin definir" }
const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
