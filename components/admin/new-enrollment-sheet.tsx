"use client"

import { Dialog } from "@base-ui/react/dialog"
import { CheckCircle2, ChevronLeft, LoaderCircle, Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"

import { createEnrollment, createNewStudentEnrollment, getEnrollmentFeeCoverage, getNewEnrollmentFinancialOptions, type CreateNewStudentEnrollmentResult } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getEnrollmentGroupLabel, type EnrollmentFinancialCoverage } from "@/lib/admin/enrollments"
import { GUARDIAN_RELATIONSHIPS, isGuardianRelationship } from "@/lib/admin/guardian-relationships"
import type { PaymentFormContext } from "@/lib/admin/payments"
import type { StudentChargeBalance } from "@/lib/admin/student-account"
import { calculateTuitionDiscountPreview, formatCurrency, formatTuitionDiscountValue, tuitionDiscountTypeLabel } from "@/lib/admin/tuition-discount-preview"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import { searchStudents, type StudentSearchResult } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/client"
import { RegisterPaymentSheet } from "@/components/admin/register-payment-sheet"
import { cn } from "@/lib/utils"

type Cycle = { id: string; name: string; starts_on: string }
type Grade = { id: string; name: string; education_level_id: string }
type Level = { id: string; name: string }
type Group = { id: string; name: string; code: string; grade_level_id: string; cycle_id: string }
type Classification = { id: string; name: string }
type Step = "student" | "academic" | "financial" | "review" | "payment" | "success"
type Contact = { full_name: string; relationship: string; phone: string; email: string }

type NewEnrollmentSheetProps = {
  cycles: Cycle[]
  operationalCycleId?: string
  levels: Level[]
  grades: Grade[]
  groups: Group[]
  classifications: Classification[]
  financialCoverage: EnrollmentFinancialCoverage[]
  triggerLabel?: string
  triggerClassName?: string
}

export function NewEnrollmentSheet({
  cycles,
  operationalCycleId,
  levels,
  grades,
  groups,
  classifications,
  financialCoverage,
  triggerLabel = "Nueva matrícula",
  triggerClassName,
}: NewEnrollmentSheetProps) {
  const today = dateInput(new Date())
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("student")
  const [studentQuery, setStudentQuery] = useState("")
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([])
  const [studentSearchState, setStudentSearchState] = useState<"idle" | "loading" | "error" | "empty">("idle")
  const [student, setStudent] = useState<StudentSearchResult | null>(null)
  const [newStudentMode, setNewStudentMode] = useState(false)
  const [studentFullName, setStudentFullName] = useState("")
  const [studentSex, setStudentSex] = useState<"H" | "M">("H")
  const [studentBirthDate, setStudentBirthDate] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([{ full_name: "", relationship: "", phone: "", email: "" }])
  const [contactOtherRelationships, setContactOtherRelationships] = useState<Record<number, string>>({})
  const [cycleId, setCycleId] = useState(operationalCycleId ?? cycles[0]?.id ?? "")
  const [educationLevelId, setEducationLevelId] = useState("")
  const [gradeLevelId, setGradeLevelId] = useState("")
  const [groupId, setGroupId] = useState("")
  const [classificationId, setClassificationId] = useState("")
  const [classesStartOn, setClassesStartOn] = useState("")
  const [activatedOn, setActivatedOn] = useState(today)
  const [initialPeriodAmount, setInitialPeriodAmount] = useState("")
  const [initialPeriodDueDate, setInitialPeriodDueDate] = useState("")
  const [initialPeriodDecision, setInitialPeriodDecision] = useState<"WAIVE" | "CHARGE">("WAIVE")
  const [baseAmount, setBaseAmount] = useState<number | null>(null)
  const [discountCategories, setDiscountCategories] = useState<TuitionDiscountCategory[]>([])
  const [discountCategoryId, setDiscountCategoryId] = useState("")
  const [financialOptionsState, setFinancialOptionsState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [enrollmentFeeCoverage, setEnrollmentFeeCoverage] = useState<"idle" | "loading" | "covered" | "uncovered" | "error">("idle")
  const [enrollmentFeeMode, setEnrollmentFeeMode] = useState<"FULL" | "PROPORTIONAL">("FULL")
  const [enrollmentFeeAmount, setEnrollmentFeeAmount] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null)
  const [pendingCharges, setPendingCharges] = useState<StudentChargeBalance[]>([])
  const [paymentContext, setPaymentContext] = useState<PaymentFormContext | null>(null)
  const [canReceiveForOthers, setCanReceiveForOthers] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentCompleted, setPaymentCompleted] = useState(false)
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
  const firstOrdinaryPeriodStart = useMemo(() => {
    if (!selectedGrade) return null
    const coverage = financialCoverage.find(
      (item) => item.cycleId === cycleId && item.educationLevelId === selectedGrade.education_level_id
    )
    if (!coverage?.months.length) return null

    const firstOrdinaryPeriod = coverage.months.reduce((earliest, item) =>
      item.year * 12 + item.month < earliest.year * 12 + earliest.month ? item : earliest
    )
    return `${firstOrdinaryPeriod.year}-${String(firstOrdinaryPeriod.month).padStart(2, "0")}-01`
  }, [cycleId, financialCoverage, selectedGrade])

  const showInitialPeriodDecision = Boolean(newStudentMode && firstOrdinaryPeriodStart && activatedOn && activatedOn < firstOrdinaryPeriodStart)
  const needsInitialAmount = useMemo(() => {
    if (!activatedOn) return false
    if (showInitialPeriodDecision) return true

    const [year, month, day] = activatedOn.split("-").map(Number)
    if (!year || !month || !day) return false
    const coverage = financialCoverage.find(
      (item) => item.cycleId === cycleId && item.educationLevelId === selectedGrade?.education_level_id
    )
    if (!coverage?.months.length) return false

    const startsDuringConfiguredPeriod = coverage.months.some((item) => item.year === year && item.month === month)
    return startsDuringConfiguredPeriod && day > 1
  }, [activatedOn, cycleId, financialCoverage, selectedGrade, showInitialPeriodDecision])

  const initialPeriodChargeSelected = !showInitialPeriodDecision || initialPeriodDecision === "CHARGE"
  const economicStartForRpc = showInitialPeriodDecision && initialPeriodDecision === "WAIVE"
    ? firstOrdinaryPeriodStart ?? activatedOn
    : showInitialPeriodDecision && initialPeriodDecision === "CHARGE"
      ? activatedOn
      : activatedOn
  const selectedDiscountCategory = discountCategories.find((category) => category.id === discountCategoryId) ?? null
  const selectedDiscountVersion = selectedDiscountCategory?.versions
    .filter((version) => version.validFrom <= activatedOn && (!version.validUntil || version.validUntil >= activatedOn))
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0] ?? null
  const discountPreview = baseAmount !== null && selectedDiscountCategory && selectedDiscountVersion
    ? calculateTuitionDiscountPreview(baseAmount, selectedDiscountCategory.discountType, selectedDiscountVersion.value)
    : null
  const individualAmount = discountPreview?.agreedAmount ?? baseAmount
  const suggestedInitialAmount = useMemo(() => {
    if (!needsInitialAmount || individualAmount === null || !activatedOn) return ""
    const [year, month, day] = activatedOn.split("-").map(Number)
    if (!year || !month || !day) return ""
    const daysInMonth = new Date(year, month, 0).getDate()
    const applicableDays = daysInMonth - day + 1
    return (Math.round(individualAmount * applicableDays / daysInMonth * 100) / 100).toFixed(2)
  }, [activatedOn, individualAmount, needsInitialAmount])
  const ordinaryPeriod = useMemo(() => {
    if (!activatedOn || !selectedGrade) return null
    const [year, month] = activatedOn.split("-").map(Number)
    const coverage = financialCoverage.find(
      (item) => item.cycleId === cycleId && item.educationLevelId === selectedGrade.education_level_id
    )
    return coverage?.months.find((item) => item.year === year && item.month === month) ?? null
  }, [activatedOn, cycleId, financialCoverage, selectedGrade])

  useEffect(() => {
    if (!newStudentMode || !educationLevelId || !cycleId || !activatedOn) return
    let cancelled = false
    const request = window.setTimeout(() => {
      setFinancialOptionsState("loading")
      void getNewEnrollmentFinancialOptions({ cycleId, educationLevelId, effectiveOn: activatedOn }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setFinancialOptionsState("error")
        setError(result.message)
        return
      }
      setBaseAmount(result.data.baseAmount)
      setDiscountCategories(result.data.discountCategories)
      setDiscountCategoryId((current) => result.data.discountCategories.some((category) => category.id === current) ? current : "")
      setFinancialOptionsState("ready")
      })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(request) }
  }, [activatedOn, cycleId, educationLevelId, newStudentMode])

  useEffect(() => {
    const update = window.setTimeout(() => {
      if (suggestedInitialAmount) setInitialPeriodAmount(suggestedInitialAmount)
      if (!needsInitialAmount || !initialPeriodChargeSelected) {
        setInitialPeriodDueDate("")
      } else if (!showInitialPeriodDecision) {
        setInitialPeriodDueDate(ordinaryPeriod?.dueDate ?? "")
      } else {
        setInitialPeriodDueDate("")
      }
    }, 0)
    return () => window.clearTimeout(update)
  }, [activatedOn, initialPeriodChargeSelected, needsInitialAmount, ordinaryPeriod, showInitialPeriodDecision, suggestedInitialAmount])

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
    if (!cycleId) return

    if (newStudentMode) {
      setEnrollmentFeeCoverage("uncovered")
      return
    }
    if (!student) return

    setEnrollmentFeeCoverage("loading")
    const result = await getEnrollmentFeeCoverage({ studentId: student.id, cycleId })
    setEnrollmentFeeCoverage(result.ok ? result.covered ? "covered" : "uncovered" : "error")
    if (!result.ok) setError(result.message)
  }

  function submit() {
    const message = stepError()
    if (message || (!student && !newStudentMode)) {
      setError(message ?? "Selecciona un alumno o elige alta de alumno nuevo.")
      return
    }

    startTransition(async () => {
      if (newStudentMode) {
        const result = await createNewStudentEnrollment({
          studentFullName,
          studentSex,
          studentBirthDate,
          contacts: contacts.map((contact, index) => ({
            ...contact,
            relationship: contact.relationship === "Otro" ? contactOtherRelationships[index]?.trim() ?? "" : contact.relationship,
          })),
          cycleId,
          gradeLevelId,
          groupId: groupId || null,
          classificationId,
          discountCategoryId: discountCategoryId || null,
          classesStartOn: classesStartOn || null,
          activatedOn,
          economicStartOn: economicStartForRpc,
          initialPeriodAmount: needsInitialAmount && initialPeriodChargeSelected ? initialPeriodAmount || null : null,
          initialPeriodDueDate: needsInitialAmount && initialPeriodChargeSelected ? initialPeriodDueDate || null : null,
          enrollmentFeeMode: enrollmentFeeCoverage === "uncovered" ? enrollmentFeeMode : null,
          enrollmentFeeAmount: enrollmentFeeCoverage === "uncovered" ? enrollmentFeeAmount || null : null,
          reason,
        })
        if (!result.ok) {
          setError(result.message)
          return
        }
        handleCreatedStudent(result)
        return
      }

      if (!student) return
      const result = await createEnrollment({
        studentId: student.id,
        cycleId,
        gradeLevelId,
        groupId: groupId || null,
        classificationId,
        classesStartOn: classesStartOn || null,
        activatedOn,
        economicStartOn: economicStartForRpc,
        initialPeriodAmount: needsInitialAmount && initialPeriodChargeSelected ? initialPeriodAmount || null : null,
        initialPeriodDueDate: needsInitialAmount && initialPeriodChargeSelected ? initialPeriodDueDate || null : null,
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

  function handleCreatedStudent(result: Extract<CreateNewStudentEnrollmentResult, { ok: true }>) {
    setCreatedStudentId(result.studentId)
    setSuccessId(result.enrollmentId)
    setPendingCharges(result.charges)
    setPaymentContext(result.paymentContext)
    setCanReceiveForOthers(result.canReceiveForOthers)
    setPaymentCompleted(false)
    setError(null)
    setStep(result.charges.length ? "payment" : "success")
  }

  function updateContact(index: number, field: keyof Contact, value: string) {
    setContacts((current) => current.map((contact, contactIndex) => contactIndex === index ? { ...contact, [field]: value } : contact))
  }

  function stepError() {
    if (step === "student") {
      if (newStudentMode) {
        if (!studentFullName.trim()) return "Indica el nombre completo del alumno."
        if (!studentBirthDate) return "Captura la fecha de nacimiento del alumno."
        if (contacts.length < 1 || contacts.some((contact, index) => !contact.full_name.trim() || !contact.relationship.trim() || (contact.relationship === "Otro" && !contactOtherRelationships[index]?.trim()) || !contact.phone.trim())) {
          return "Completa nombre, parentesco y teléfono del contacto principal."
        }
      } else if (!student) {
        return "Busca y selecciona un alumno existente."
      }
    }
    if (step === "academic") {
      if (!cycleId || !educationLevelId || !gradeLevelId || !classificationId) {
        return "Selecciona ciclo, nivel, grado y clasificación."
      }
      if (!activatedOn) return "Captura la fecha efectiva de ingreso."
    }
    if (step === "financial") {
      if (needsInitialAmount && initialPeriodChargeSelected && !initialPeriodAmount.trim()) {
        return "Captura el importe acordado para el primer periodo."
      }
      if (showInitialPeriodDecision && initialPeriodChargeSelected && !initialPeriodDueDate.trim()) {
        return "Define cuándo este cargo se considerará vencido."
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
    setNewStudentMode(false)
    setStudentFullName("")
    setStudentSex("H")
    setStudentBirthDate("")
    setContacts([{ full_name: "", relationship: "", phone: "", email: "" }])
    setContactOtherRelationships({})
    setEducationLevelId("")
    setGradeLevelId("")
    setGroupId("")
    setClassificationId("")
    setClassesStartOn("")
    setActivatedOn(today)
    setInitialPeriodAmount("")
    setInitialPeriodDueDate("")
    setInitialPeriodDecision("WAIVE")
    setBaseAmount(null)
    setDiscountCategories([])
    setDiscountCategoryId("")
    setFinancialOptionsState("idle")
    setEnrollmentFeeCoverage("idle")
    setEnrollmentFeeMode("FULL")
    setEnrollmentFeeAmount("")
    setReason("")
    setError(null)
    setSuccessId(null)
    setCreatedStudentId(null)
    setPendingCharges([])
    setPaymentContext(null)
    setCanReceiveForOthers(false)
    setPaymentOpen(false)
    setPaymentCompleted(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (!nextOpen) reset()
    }}>
      <Dialog.Trigger render={<Button className={cn("h-10", triggerClassName)}><Plus /> {triggerLabel}</Button>} />
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
                  <p className="mt-1 text-sm text-muted-foreground">Selecciona un alumno existente o captura un alta nueva.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2"><Choice label="Alumno existente" checked={!newStudentMode} onChange={() => { setNewStudentMode(false); setStudentFullName(""); setError(null) }} /><Choice label="Alumno nuevo" checked={newStudentMode} onChange={() => { setNewStudentMode(true); setStudent(null); setStudentQuery(""); setStudentResults([]); setEnrollmentFeeCoverage("idle"); setError(null) }} /></div>
                {newStudentMode ? (
                  <div className="space-y-4">
                    <Field label="Nombre completo"><Input value={studentFullName} onChange={(event) => setStudentFullName(event.target.value)} placeholder="Nombre y apellidos" /></Field>
                    <div className="grid gap-4 sm:grid-cols-2"><Field label="Sexo"><select value={studentSex} onChange={(event) => setStudentSex(event.target.value as "H" | "M")} className={selectClass}><option value="H">H</option><option value="M">M</option></select></Field><Field label="Fecha de nacimiento"><Input type="date" value={studentBirthDate} onChange={(event) => setStudentBirthDate(event.target.value)} /></Field></div>
                    <div className="space-y-3"><div><h3 className="text-sm font-semibold">Contactos</h3><p className="mt-1 text-sm text-muted-foreground">Agrega al menos un contacto. Puedes agregar un segundo.</p></div>{contacts.map((contact, index) => { const relationshipValue = isGuardianRelationship(contact.relationship) ? contact.relationship : contact.relationship ? "Otro" : ""; return <div key={index} className="space-y-3 rounded-lg border border-border p-4"><p className="text-sm font-medium">Contacto {index + 1}</p><Field label="Nombre completo"><Input value={contact.full_name} onChange={(event) => updateContact(index, "full_name", event.target.value)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Parentesco"><select value={relationshipValue} onChange={(event) => { const value = event.target.value; updateContact(index, "relationship", value === "Otro" ? "Otro" : value); setContactOtherRelationships((current) => ({ ...current, [index]: value === "Otro" ? current[index] ?? "" : "" })) }} className={selectClass}><option value="">Selecciona un parentesco</option>{GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></Field><Field label="Teléfono"><Input value={contact.phone} onChange={(event) => updateContact(index, "phone", event.target.value)} /></Field></div>{relationshipValue === "Otro" && <Field label="Especificar parentesco"><Input value={contactOtherRelationships[index] ?? (contact.relationship === "Otro" ? "" : contact.relationship)} onChange={(event) => { setContactOtherRelationships((current) => ({ ...current, [index]: event.target.value })); updateContact(index, "relationship", "Otro") }} /></Field>}<Field label="Email (opcional)"><Input type="email" value={contact.email} onChange={(event) => updateContact(index, "email", event.target.value)} /></Field>{index === 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setContacts((current) => current.slice(0, 1))}>Quitar contacto</Button>}</div>})}{contacts.length < 2 && <Button type="button" variant="outline" onClick={() => setContacts((current) => [...current, { full_name: "", relationship: "", phone: "", email: "" }])}><Plus /> Agregar contacto</Button>}</div>
                  </div>
                ) : student ? (
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
                {newStudentMode && <section className="space-y-3 border-y border-border py-4"><div><h3 className="text-sm font-semibold">Beneficio de colegiatura</h3><p className="mt-1 text-sm text-muted-foreground">Se aplicará sobre la colegiatura base vigente para la fecha de ingreso.</p></div>{financialOptionsState === "loading" && <p className="text-sm text-muted-foreground">Consultando colegiatura y beneficios...</p>}{financialOptionsState === "error" && <p className="text-sm text-destructive">No pudimos consultar la colegiatura base y los beneficios.</p>}{financialOptionsState === "ready" && <Field label="Categoría"><select value={discountCategoryId} onChange={(event) => setDiscountCategoryId(event.target.value)} className={selectClass}><option value="">Sin beneficio</option>{discountCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>}{baseAmount !== null && <dl className="grid gap-2 rounded-lg bg-muted/30 px-3 py-3 text-sm"><Summary label="Colegiatura base" value={formatCurrency(baseAmount)} /><Summary label="Beneficio" value={selectedDiscountCategory && selectedDiscountVersion ? `-${formatTuitionDiscountValue(selectedDiscountVersion.value, selectedDiscountCategory.discountType)} · ${tuitionDiscountTypeLabel(selectedDiscountCategory.discountType)}` : "Sin beneficio"} /><Summary label="Colegiatura individual" value={formatCurrency(individualAmount ?? baseAmount)} /></dl>}</section>}
                {needsInitialAmount && <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4"><div><p className="text-sm font-medium">Primer periodo / ingreso inicial</p><p className="mt-1 text-sm text-muted-foreground">{showInitialPeriodDecision ? "Define si este segmento inicial genera un cobro." : "Captura el importe acordado para el ingreso dentro del periodo."}</p></div>{showInitialPeriodDecision && <div className="grid gap-2"><Choice label="No cobrar este periodo" checked={initialPeriodDecision === "WAIVE"} onChange={() => { setInitialPeriodDecision("WAIVE"); setInitialPeriodAmount(""); setInitialPeriodDueDate("") }} /><Choice label="Cobrar este periodo" checked={initialPeriodDecision === "CHARGE"} onChange={() => setInitialPeriodDecision("CHARGE")} /></div>}{initialPeriodChargeSelected && <div className="grid gap-4 sm:grid-cols-2"><Field label="Importe del primer periodo"><Input inputMode="decimal" value={initialPeriodAmount} onChange={(event) => setInitialPeriodAmount(event.target.value)} placeholder="0.00" /></Field>{showInitialPeriodDecision && <div><Field label="Fecha de vencimiento"><Input type="date" value={initialPeriodDueDate} onChange={(event) => setInitialPeriodDueDate(event.target.value)} /></Field><p className="mt-1 text-xs text-muted-foreground">Define cuándo este cargo se considerará vencido.</p></div>}</div>}</div>}
                <div className="space-y-3 border-y border-border py-4"><div><h3 className="text-sm font-semibold">Inscripción</h3>{(enrollmentFeeCoverage === "idle" || enrollmentFeeCoverage === "loading") && <p className="mt-1 text-sm text-muted-foreground">Consultando cobertura de inscripción...</p>}{enrollmentFeeCoverage === "covered" && <p className="mt-1 text-sm text-emerald-700">Inscripción cubierta para este ciclo.</p>}{enrollmentFeeCoverage === "uncovered" && <p className="mt-1 text-sm text-muted-foreground">Debe generar inscripción.</p>}{enrollmentFeeCoverage === "error" && <div className="mt-1 flex items-center justify-between gap-3"><p className="text-sm text-destructive">No pudimos consultar la cobertura de inscripción.</p><Button type="button" variant="outline" size="sm" onClick={() => void loadEnrollmentFeeCoverage()}>Reintentar</Button></div>}</div>{enrollmentFeeCoverage === "uncovered" && <><div className="grid gap-2"><Choice label="Completa" checked={enrollmentFeeMode === "FULL"} onChange={() => setEnrollmentFeeMode("FULL")} /><Choice label="Proporcional" checked={enrollmentFeeMode === "PROPORTIONAL"} onChange={() => setEnrollmentFeeMode("PROPORTIONAL")} /></div>{enrollmentFeeMode === "PROPORTIONAL" && <Field label="Importe de inscripción"><Input inputMode="decimal" value={enrollmentFeeAmount} onChange={(event) => setEnrollmentFeeAmount(event.target.value)} placeholder="0.00" /></Field>}</>}</div>
                <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Alta al ciclo 2026-2027" rows={3} /></Field>
              </section>
            )}

            {step === "review" && (student || newStudentMode) && (
              <section className="space-y-5"><div><h2 className="text-lg font-semibold">Resumen de matrícula</h2><p className="mt-1 text-sm text-muted-foreground">Revisa la información antes de activar la matrícula.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={newStudentMode ? studentFullName : student?.fullName ?? ""} /><Summary label="Ciclo" value={selectedCycle?.name ?? ""} /><Summary label="Grado" value={`${selectedLevel?.name ?? ""}${selectedLevel ? " " : ""}${selectedGrade?.name ?? ""}${groupLabel ? ` ${groupLabel}` : ""}`} /><Summary label="Clasificación" value={selectedClassification?.name ?? ""} /><Summary label="Fecha efectiva de ingreso" value={formatDate(activatedOn)} />{newStudentMode && <><Summary label="Beneficio" value={selectedDiscountCategory?.name ?? "Sin beneficio"} /><Summary label="Colegiatura base" value={baseAmount === null ? "Sin dato" : formatCurrency(baseAmount)} /><Summary label="Colegiatura individual" value={individualAmount === null ? "Sin dato" : formatCurrency(individualAmount)} /></>}<Summary label="Plan" value="12 pagos predeterminado" /><Summary label="Colegiatura inicial" value={!needsInitialAmount ? "Inicio de periodo · colegiatura vigente" : !initialPeriodChargeSelected ? "No cobrar este periodo" : showInitialPeriodDecision ? `$${initialPeriodAmount || "0.00"} acordado · vence ${formatDate(initialPeriodDueDate)}` : `$${initialPeriodAmount || "0.00"} acordado`} /><Summary label="Inscripción" value={enrollmentFeeCoverage === "covered" ? "Inscripción cubierta para este ciclo" : enrollmentFeeMode === "PROPORTIONAL" ? `Inscripción proporcional · $${enrollmentFeeAmount || "0.00"}` : "Inscripción completa"} /></dl></section>
            )}

            {step === "payment" && createdStudentId && <section className="space-y-5"><div><h2 className="text-lg font-semibold">Pago pendiente</h2><p className="mt-1 text-sm text-muted-foreground">La matrícula quedó activa y tiene cargos pendientes.</p></div><div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">Puedes registrar el pago ahora o hacerlo después desde la cuenta del alumno.</div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setPaymentOpen(true)}>Registrar pago</Button><Button type="button" variant="outline" onClick={() => setStep("success")}>Registrar después</Button></div></section>}
            {step === "success" && successId && <section className="py-8 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h2 className="mt-4 text-lg font-semibold">Alumno creado y matrícula activada</h2><p className="mt-2 text-sm text-muted-foreground">El alumno, sus contactos y la matrícula quedaron registrados correctamente.</p>{paymentCompleted && <p className="mt-2 text-sm text-emerald-700">El pago quedó registrado.</p>}<Link href="/admin/matricula" className="mt-6 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Ver matrículas</Link></section>}
          </div>

          {step !== "success" && step !== "payment" && <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" className="h-10" disabled={step === "student" || isPending} onClick={() => { setError(null); setStep(previousStep(step)) }}><ChevronLeft /> Atrás</Button>{step === "review" ? <Button className="h-10" disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Activando..." : "Activar matrícula"}</Button> : <Button className="h-10" onClick={next}>Continuar</Button>}</footer>}
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
          {createdStudentId && pendingCharges.length > 0 && paymentContext && <RegisterPaymentSheet student={{ id: createdStudentId, fullName: studentFullName, context: "Nueva matrícula" }} charges={pendingCharges} methods={paymentContext.methods} receivers={paymentContext.receivers} currentReceiverId={paymentContext.currentReceiverId} canReceiveForOthers={canReceiveForOthers} open={paymentOpen} onOpenChange={(nextOpen) => { setPaymentOpen(nextOpen); if (!nextOpen && paymentCompleted) setStep("success") }} hideTrigger onPaymentRegistered={() => setPaymentCompleted(true)} />}
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
function stepLabel(step: Step) { return ({ student: "Paso 1 de 4 · Alumno", academic: "Paso 2 de 4 · Ciclo y grupo", financial: "Paso 3 de 4 · Finanzas", review: "Paso 4 de 4 · Resumen", payment: "Pago pendiente", success: "" } as const)[step] }
function dateInput(date: Date) { return date.toISOString().slice(0, 10) }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "" }

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted"
