"use client"

import { Dialog } from "@base-ui/react/dialog"
import { CheckCircle2, ChevronLeft, LoaderCircle, Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"

import { createEnrollment, getEnrollmentFeeCoverage } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getEnrollmentGroupLabel, type EnrollmentFinancialCoverage } from "@/lib/admin/enrollments"
import { searchStudents, type StudentSearchResult } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/client"

type Cycle = { id: string; name: string; starts_on: string }
type Grade = { id: string; name: string; education_level_id: string }
type Level = { id: string; name: string }
type Group = { id: string; name: string; code: string; grade_level_id: string; cycle_id: string }
type Classification = { id: string; name: string }
type Step = "student" | "academic" | "financial" | "review" | "success"

type NewEnrollmentSheetProps = {
  cycles: Cycle[]
  operationalCycleId?: string
  levels: Level[]
  grades: Grade[]
  groups: Group[]
  classifications: Classification[]
  financialCoverage: EnrollmentFinancialCoverage[]
}

export function NewEnrollmentSheet({
  cycles,
  operationalCycleId,
  levels,
  grades,
  groups,
  classifications,
  financialCoverage,
}: NewEnrollmentSheetProps) {
  const today = dateInput(new Date())
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("student")
  const [studentQuery, setStudentQuery] = useState("")
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([])
  const [studentSearchState, setStudentSearchState] = useState<"idle" | "loading" | "error" | "empty">("idle")
  const [student, setStudent] = useState<StudentSearchResult | null>(null)
  const [cycleId, setCycleId] = useState(operationalCycleId ?? cycles[0]?.id ?? "")
  const [educationLevelId, setEducationLevelId] = useState("")
  const [gradeLevelId, setGradeLevelId] = useState("")
  const [groupId, setGroupId] = useState("")
  const [classificationId, setClassificationId] = useState("")
  const [classesStartOn, setClassesStartOn] = useState("")
  const [activatedOn, setActivatedOn] = useState(today)
  const [economicStartOn, setEconomicStartOn] = useState(today)
  const [initialPeriodAmount, setInitialPeriodAmount] = useState("")
  const [initialPeriodDueDate, setInitialPeriodDueDate] = useState("")
  const [enrollmentFeeCoverage, setEnrollmentFeeCoverage] = useState<"idle" | "loading" | "covered" | "uncovered" | "error">("idle")
  const [enrollmentFeeMode, setEnrollmentFeeMode] = useState<"FULL" | "PROPORTIONAL">("FULL")
  const [enrollmentFeeAmount, setEnrollmentFeeAmount] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId) ?? null
  const selectedGrade = grades.find((grade) => grade.id === gradeLevelId) ?? null
  const selectedLevel = levels.find((level) => level.id === educationLevelId) ?? null
  const selectedGroup = groups.find((group) => group.id === groupId) ?? null
  const selectedClassification = classifications.find((item) => item.id === classificationId) ?? null
  const availableGrades = grades.filter((grade) => grade.education_level_id === educationLevelId)
  const availableGroups = groups.filter(
    (group) => group.cycle_id === cycleId && group.grade_level_id === gradeLevelId
  )
  const groupLabel = selectedGroup ? getEnrollmentGroupLabel(selectedGroup) : ""
  const needsInitialAmount = useMemo(() => {
    if (!selectedGrade || !economicStartOn) return false
    const [year, month, day] = economicStartOn.split("-").map(Number)
    if (!year || !month || !day || day === 1) return false
    const coverage = financialCoverage.find(
      (item) => item.cycleId === cycleId && item.educationLevelId === selectedGrade.education_level_id
    )
    return coverage?.months.some((item) => item.year === year && item.month === month) ?? false
  }, [cycleId, economicStartOn, financialCoverage, selectedGrade])

  useEffect(() => {
    const value = studentQuery.trim()
    if (student || value.length < 2) {
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setStudentSearchState("loading")
      const { data, error: searchError } = await searchStudents(createClient(), value)
      if (cancelled) return
      setStudentResults(searchError ? [] : data)
      setStudentSearchState(searchError ? "error" : data.length ? "idle" : "empty")
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [student, studentQuery])

  function next() {
    const message = stepError()
    if (message) {
      setError(message)
      return
    }
    setError(null)
    setStep(nextStep(step))
    if (step === "academic") void loadEnrollmentFeeCoverage()
  }

  async function loadEnrollmentFeeCoverage() {
    if (!student || !cycleId) return

    setEnrollmentFeeCoverage("loading")
    const result = await getEnrollmentFeeCoverage({ studentId: student.id, cycleId })
    setEnrollmentFeeCoverage(result.ok ? result.covered ? "covered" : "uncovered" : "error")
    if (!result.ok) setError(result.message)
  }

  function submit() {
    const message = stepError()
    if (message || !student) {
      setError(message ?? "Selecciona un alumno.")
      return
    }

    startTransition(async () => {
      const result = await createEnrollment({
        studentId: student.id,
        cycleId,
        gradeLevelId,
        groupId: groupId || null,
        classificationId,
        classesStartOn: classesStartOn || null,
        activatedOn,
        economicStartOn,
        initialPeriodAmount: initialPeriodAmount || null,
        initialPeriodDueDate: initialPeriodDueDate || null,
        enrollmentFeeMode: enrollmentFeeCoverage === "uncovered" ? enrollmentFeeMode : null,
        enrollmentFeeAmount: enrollmentFeeCoverage === "uncovered" ? enrollmentFeeAmount || null : null,
        reason,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setSuccessId(result.enrollmentId)
      setStep("success")
      setError(null)
    })
  }

  function stepError() {
    if (step === "student" && !student) return "Busca y selecciona un alumno existente."
    if (step === "academic") {
      if (!cycleId || !educationLevelId || !gradeLevelId || !classificationId) {
        return "Selecciona ciclo, nivel, grado y clasificación."
      }
      if (!activatedOn) return "Captura la fecha efectiva de ingreso."
    }
    if (step === "financial") {
      if (!economicStartOn) return "Captura el inicio económico."
      if (needsInitialAmount && !initialPeriodAmount.trim()) {
        return "Captura el importe acordado para el primer periodo."
      }
      if (enrollmentFeeCoverage === "idle" || enrollmentFeeCoverage === "loading") {
        return "Espera a que confirmemos el estado de la inscripción."
      }
      if (enrollmentFeeCoverage === "error") {
        return "No pudimos consultar si la inscripción está cubierta. Inténtalo de nuevo."
      }
      if (enrollmentFeeCoverage === "uncovered" && enrollmentFeeMode === "PROPORTIONAL") {
        const amount = Number(enrollmentFeeAmount)
        if (!enrollmentFeeAmount.trim() || !Number.isFinite(amount) || amount < 0) {
          return "Captura un importe válido para la inscripción proporcional."
        }
      }
      if (!reason.trim()) return "Indica el motivo de la matrícula."
    }
    return null
  }

  function reset() {
    setStep("student")
    setStudentQuery("")
    setStudentResults([])
    setStudent(null)
    setEducationLevelId("")
    setGradeLevelId("")
    setGroupId("")
    setClassificationId("")
    setClassesStartOn("")
    setActivatedOn(today)
    setEconomicStartOn(today)
    setInitialPeriodAmount("")
    setInitialPeriodDueDate("")
    setEnrollmentFeeCoverage("idle")
    setEnrollmentFeeMode("FULL")
    setEnrollmentFeeAmount("")
    setReason("")
    setError(null)
    setSuccessId(null)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (!nextOpen) reset()
    }}>
      <Dialog.Trigger render={<Button className="h-10"><Plus /> Nueva matrícula</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">Nueva matrícula</Dialog.Title>
              {step !== "success" && <p className="mt-0.5 text-xs text-muted-foreground">{stepLabel(step)}</p>}
            </div>
            <Dialog.Close aria-label="Cerrar matrícula" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {step === "student" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Alumno</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Selecciona un alumno existente para este ciclo.</p>
                </div>
                {student ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{student.fullName}</p><p className="mt-1 text-xs text-muted-foreground">Alumno seleccionado</p></div>
                    <Button variant="ghost" size="sm" onClick={() => { setStudent(null); setEnrollmentFeeCoverage("idle") }}>Cambiar</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={studentQuery} onChange={(event) => { setStudentQuery(event.target.value); setStudentResults([]); setStudentSearchState("idle"); setError(null) }} placeholder="Buscar por nombre..." className="h-11 bg-white pl-10" /></div>
                    <StudentResults results={studentResults} state={studentSearchState} onSelect={(result) => { setStudent(result); setStudentResults([]); setStudentQuery(result.fullName); setEnrollmentFeeCoverage("idle") }} />
                  </>
                )}
              </section>
            )}

            {step === "academic" && (
              <section className="space-y-5">
                <div><h2 className="text-lg font-semibold">Ciclo y grupo</h2><p className="mt-1 text-sm text-muted-foreground">Define el contexto académico de la matrícula.</p></div>
                <Field label="Ciclo"><select value={cycleId} onChange={(event) => { setCycleId(event.target.value); setGroupId(""); setEnrollmentFeeCoverage("idle"); setEnrollmentFeeMode("FULL"); setEnrollmentFeeAmount("") }} className={selectClass}>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></Field>
                <Field label="Nivel"><select value={educationLevelId} onChange={(event) => { setEducationLevelId(event.target.value); setGradeLevelId(""); setGroupId("") }} className={selectClass}><option value="">Selecciona un nivel</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
                <Field label="Grado"><select value={gradeLevelId} onChange={(event) => { setGradeLevelId(event.target.value); setGroupId("") }} className={selectClass} disabled={!educationLevelId}><option value="">Selecciona un grado</option>{availableGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field>
                <Field label="Grupo"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={selectClass} disabled={!gradeLevelId}><option value="">Sin grupo asignado</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field>
                <Field label="Clasificación"><select value={classificationId} onChange={(event) => setClassificationId(event.target.value)} className={selectClass}><option value="">Selecciona una clasificación</option>{classifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha efectiva de ingreso"><Input type="date" value={activatedOn} onChange={(event) => setActivatedOn(event.target.value)} /></Field><Field label="Inicio de clases"><Input type="date" value={classesStartOn} onChange={(event) => setClassesStartOn(event.target.value)} /></Field></div>
              </section>
            )}

            {step === "financial" && (
              <section className="space-y-5">
                <div><h2 className="text-lg font-semibold">Configuración financiera</h2><p className="mt-1 text-sm text-muted-foreground">Se aplicará el plan predeterminado de 12 pagos configurado para el ciclo y nivel.</p></div>
                <Field label="Inicio económico"><Input type="date" value={economicStartOn} onChange={(event) => setEconomicStartOn(event.target.value)} /></Field>
                {needsInitialAmount && <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4"><div><p className="text-sm font-medium">Primer cobro de ingreso tardío</p><p className="mt-1 text-sm text-muted-foreground">Captura el importe acordado. No calculamos este monto automáticamente.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Importe del primer periodo"><Input inputMode="decimal" value={initialPeriodAmount} onChange={(event) => setInitialPeriodAmount(event.target.value)} placeholder="0.00" /></Field><Field label="Fecha de vencimiento"><Input type="date" value={initialPeriodDueDate} onChange={(event) => setInitialPeriodDueDate(event.target.value)} /></Field></div></div>}
                <div className="space-y-3 border-y border-border py-4"><div><h3 className="text-sm font-semibold">Inscripción</h3>{(enrollmentFeeCoverage === "idle" || enrollmentFeeCoverage === "loading") && <p className="mt-1 text-sm text-muted-foreground">Consultando cobertura de inscripción...</p>}{enrollmentFeeCoverage === "covered" && <p className="mt-1 text-sm text-emerald-700">Inscripción cubierta para este ciclo.</p>}{enrollmentFeeCoverage === "uncovered" && <p className="mt-1 text-sm text-muted-foreground">Debe generar inscripción.</p>}{enrollmentFeeCoverage === "error" && <div className="mt-1 flex items-center justify-between gap-3"><p className="text-sm text-destructive">No pudimos consultar la cobertura de inscripción.</p><Button type="button" variant="outline" size="sm" onClick={() => void loadEnrollmentFeeCoverage()}>Reintentar</Button></div>}</div>{enrollmentFeeCoverage === "uncovered" && <><div className="grid gap-2"><Choice label="Completa" checked={enrollmentFeeMode === "FULL"} onChange={() => setEnrollmentFeeMode("FULL")} /><Choice label="Proporcional" checked={enrollmentFeeMode === "PROPORTIONAL"} onChange={() => setEnrollmentFeeMode("PROPORTIONAL")} /></div>{enrollmentFeeMode === "PROPORTIONAL" && <Field label="Importe de inscripción"><Input inputMode="decimal" value={enrollmentFeeAmount} onChange={(event) => setEnrollmentFeeAmount(event.target.value)} placeholder="0.00" /></Field>}</>}</div>
                <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Alta al ciclo 2026-2027" rows={3} /></Field>
              </section>
            )}

            {step === "review" && student && (
              <section className="space-y-5"><div><h2 className="text-lg font-semibold">Resumen de matrícula</h2><p className="mt-1 text-sm text-muted-foreground">Revisa la información antes de activar la matrícula.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={student.fullName} /><Summary label="Ciclo" value={selectedCycle?.name ?? ""} /><Summary label="Grado" value={`${selectedLevel?.name ?? ""}${selectedLevel ? " " : ""}${selectedGrade?.name ?? ""}${groupLabel ? ` ${groupLabel}` : ""}`} /><Summary label="Clasificación" value={selectedClassification?.name ?? ""} /><Summary label="Fecha de activación" value={formatDate(activatedOn)} /><Summary label="Inicio económico" value={formatDate(economicStartOn)} /><Summary label="Plan" value="12 pagos predeterminado" /><Summary label="Colegiatura inicial" value={needsInitialAmount ? `$${initialPeriodAmount || "0.00"} acordado` : "Inicio de periodo · colegiatura vigente"} /><Summary label="Inscripción" value={enrollmentFeeCoverage === "covered" ? "Inscripción cubierta para este ciclo" : enrollmentFeeMode === "PROPORTIONAL" ? `Inscripción proporcional · $${enrollmentFeeAmount || "0.00"}` : "Inscripción completa"} /></dl></section>
            )}

            {step === "success" && successId && <section className="py-8 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h2 className="mt-4 text-lg font-semibold">Matrícula activada</h2><p className="mt-2 text-sm text-muted-foreground">La matrícula, su acuerdo base y las colegiaturas quedaron registrados.</p><Link href="/admin/matricula" className="mt-6 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Ver matrículas</Link></section>}
          </div>

          {step !== "success" && <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" className="h-10" disabled={step === "student" || isPending} onClick={() => { setError(null); setStep(previousStep(step)) }}><ChevronLeft /> Atrás</Button>{step === "review" ? <Button className="h-10" disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Activando..." : "Activar matrícula"}</Button> : <Button className="h-10" onClick={next}>Continuar</Button>}</footer>}
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function StudentResults({ results, state, onSelect }: { results: StudentSearchResult[]; state: "idle" | "loading" | "error" | "empty"; onSelect: (result: StudentSearchResult) => void }) {
  if (state === "loading") return <div className="rounded-lg border border-border px-4 py-4 text-sm text-muted-foreground">Buscando alumnos...</div>
  if (state === "error") return <div className="rounded-lg border border-border px-4 py-4 text-sm text-muted-foreground">No pudimos buscar alumnos. Inténtalo de nuevo.</div>
  if (state === "empty") return <div className="rounded-lg border border-border px-4 py-4 text-sm text-muted-foreground">No encontramos alumnos con ese nombre.</div>
  if (!results.length) return null
  return <div className="overflow-hidden rounded-lg border border-border">{results.map((result) => <button key={result.id} type="button" onClick={() => onSelect(result)} className="flex min-h-14 w-full items-center border-b border-border px-4 text-left text-sm last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span><span className="block font-medium">{result.fullName}</span>{result.gradeName && <span className="mt-1 block text-xs text-muted-foreground">{result.gradeName}{result.groupName ? ` · ${result.groupName}` : ""}</span>}</span></button>)}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium"><input type="radio" checked={checked} onChange={onChange} />{label}</label>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || "Sin dato"}</dd></div>
}

function nextStep(step: Step): Step { return ({ student: "academic", academic: "financial", financial: "review" } as const)[step as "student" | "academic" | "financial"] ?? step }
function previousStep(step: Step): Step { return ({ academic: "student", financial: "academic", review: "financial" } as const)[step as "academic" | "financial" | "review"] ?? step }
function stepLabel(step: Step) { return ({ student: "Paso 1 de 4 · Alumno", academic: "Paso 2 de 4 · Ciclo y grupo", financial: "Paso 3 de 4 · Finanzas", review: "Paso 4 de 4 · Resumen" } as const)[step as "student" | "academic" | "financial" | "review"] }
function dateInput(date: Date) { return date.toISOString().slice(0, 10) }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "" }

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted"
