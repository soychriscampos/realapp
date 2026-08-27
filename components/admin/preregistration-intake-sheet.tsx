"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, ChevronLeft, LoaderCircle, Plus, Search, UserPlus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"

import {
  createPreregistrationIntake,
  getPreregistrationIntakeStudent,
  searchPreregistrationIntakeStudents,
  type PreregistrationIntakeContact,
  type PreregistrationPaymentContext,
  type PreregistrationIntakeStudent,
  type PreregistrationIntakeStudentDetail,
} from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { RegisterPaymentSheet } from "@/components/admin/register-payment-sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getEnrollmentGroupLabel } from "@/lib/admin/enrollments"
import { GUARDIAN_RELATIONSHIPS, isGuardianRelationship } from "@/lib/admin/guardian-relationships"
import type { PreregistrationCampaign } from "@/lib/admin/preregistration-campaigns"
import type { PaymentFormContext } from "@/lib/admin/payments"

type Cycle = { id: string; name: string }
type Level = { id: string; name: string }
type Grade = { id: string; name: string; education_level_id: string; sort_order?: number }
type Group = { id: string; name: string; code: string; cycle_id: string; grade_level_id: string }
type Step = "student" | "destination" | "contacts" | "review" | "payment" | "success"

type PreregistrationIntakeSheetProps = {
  campaigns: PreregistrationCampaign[]
  cycles: Cycle[]
  levels: Level[]
  grades: Grade[]
  groups: Group[]
  operationalCycleId?: string
  paymentContext: PaymentFormContext | null
  canReceiveForOthers: boolean
}

const emptyContact = (): PreregistrationIntakeContact => ({ guardianId: null, fullName: "", phone: "", email: "", relationship: "" })

export function PreregistrationIntakeSheet({ campaigns, cycles, levels, grades, groups, operationalCycleId, paymentContext: paymentFormContext, canReceiveForOthers }: PreregistrationIntakeSheetProps) {
  const today = dateInput(new Date())
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("student")
  const [preregisteredOn, setPreregisteredOn] = useState(today)
  const [studentQuery, setStudentQuery] = useState("")
  const [studentResults, setStudentResults] = useState<PreregistrationIntakeStudent[]>([])
  const [studentSearchState, setStudentSearchState] = useState<"idle" | "loading" | "error" | "empty">("idle")
  const [student, setStudent] = useState<PreregistrationIntakeStudentDetail | null>(null)
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [isNewStudent, setIsNewStudent] = useState(false)
  const [studentFullName, setStudentFullName] = useState("")
  const [cycleId, setCycleId] = useState(operationalCycleId ?? cycles[0]?.id ?? "")
  const [educationLevelId, setEducationLevelId] = useState("")
  const [gradeLevelId, setGradeLevelId] = useState("")
  const [groupId, setGroupId] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [contacts, setContacts] = useState<PreregistrationIntakeContact[]>([emptyContact()])
  const [contactOtherRelationships, setContactOtherRelationships] = useState<Record<number, string>>({})
  const [payment, setPayment] = useState<PreregistrationPaymentContext | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentCompleted, setPaymentCompleted] = useState(false)
  const [historicalPreregistration, setHistoricalPreregistration] = useState<false | "PENDING" | "COVERED" | "UNLINKED" | "REVIEW">(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastManager = Toast.useToastManager()
  const router = useRouter()

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId) ?? null
  const selectedLevel = levels.find((level) => level.id === educationLevelId) ?? null
  const selectedGrade = grades.find((grade) => grade.id === gradeLevelId) ?? null
  const selectedGroup = groups.find((group) => group.id === groupId) ?? null
  const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId) ?? null
  const availableGrades = grades.filter((grade) => grade.education_level_id === educationLevelId)
  const availableGroups = groups.filter((group) => group.cycle_id === cycleId && group.grade_level_id === gradeLevelId)
  const applicableCampaigns = useMemo(() => campaigns.filter((campaign) => (
    (campaign.status === "ACTIVE" || (
      campaign.status !== "CANCELLED" &&
      student?.enrollmentHistory.some((enrollment) => enrollment.cycleId === campaign.targetCycleId)
    )) &&
    campaign.targetCycleId === cycleId &&
    preregisteredOn >= campaign.startsOn &&
    preregisteredOn <= campaign.endsOn &&
    (!campaign.educationLevelId || campaign.educationLevelId === educationLevelId)
  )), [campaigns, cycleId, educationLevelId, preregisteredOn, student?.enrollmentHistory])

  useEffect(() => {
    const query = studentQuery.trim()
    if (step !== "student" || isNewStudent || student || query.length < 2) return

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setStudentSearchState("loading")
      const result = await searchPreregistrationIntakeStudents(query)
      if (cancelled) return
      setStudentResults(result.error ? [] : result.data)
      setStudentSearchState(result.error ? "error" : result.data.length ? "idle" : "empty")
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [isNewStudent, step, student, studentQuery])

  function reset() {
    setStep("student")
    setPreregisteredOn(today)
    setStudentQuery("")
    setStudentResults([])
    setStudentSearchState("idle")
    setStudent(null)
    setIsLoadingStudent(false)
    setIsNewStudent(false)
    setStudentFullName("")
    setCycleId(operationalCycleId ?? cycles[0]?.id ?? "")
    setEducationLevelId("")
    setGradeLevelId("")
    setGroupId("")
    setCampaignId("")
    setContacts([emptyContact()])
    setContactOtherRelationships({})
    setPayment(null)
    setPaymentOpen(false)
    setPaymentCompleted(false)
    setHistoricalPreregistration(false)
    setError(null)
  }

  async function selectStudent(candidate: PreregistrationIntakeStudent) {
    setIsLoadingStudent(true)
    setError(null)
    const result = await getPreregistrationIntakeStudent(candidate.id)
    setIsLoadingStudent(false)
    if (result.error || !result.data) {
      setError("No pudimos cargar los datos del alumno. Inténtalo de nuevo.")
      return
    }
    setStudent(result.data)
    setStudentQuery(result.data.fullName)
    setStudentResults([])
    setStudentSearchState("idle")
    setContacts(result.data.contacts.length ? result.data.contacts : [emptyContact()])
    setContactOtherRelationships(Object.fromEntries(result.data.contacts.flatMap((contact, index) => isGuardianRelationship(contact.relationship) || !contact.relationship ? [] : [[index, contact.relationship]])))
    if (result.data.suggestedDestination) {
      setCycleId(result.data.suggestedDestination.cycleId)
      setEducationLevelId(result.data.suggestedDestination.educationLevelId)
      setGradeLevelId(result.data.suggestedDestination.gradeLevelId)
      setGroupId(result.data.suggestedDestination.groupId ?? "")
      setCampaignId("")
    } else {
      setCycleId(operationalCycleId ?? cycles[0]?.id ?? "")
      setEducationLevelId("")
      setGradeLevelId("")
      setGroupId("")
      setCampaignId("")
    }
  }

  function startNewStudent() {
    setStudent(null)
    setIsNewStudent(true)
    setStudentFullName(studentQuery)
    setStudentResults([])
    setStudentSearchState("idle")
    setContacts([emptyContact()])
    setContactOtherRelationships({})
    setCycleId(operationalCycleId ?? cycles[0]?.id ?? "")
    setEducationLevelId("")
    setGradeLevelId("")
    setGroupId("")
    setCampaignId("")
    setError(null)
  }

  function next() {
    const validationMessage = stepError()
    if (validationMessage) return setError(validationMessage)
    setError(null)
    setStep(nextStep(step))
  }

  function back() {
    setError(null)
    setStep(previousStep(step))
  }

  function submit() {
    const validationMessage = stepError()
    if (validationMessage) return setError(validationMessage)

    startTransition(async () => {
      const result = await createPreregistrationIntake({
        preregisteredOn,
        studentId: student?.id ?? null,
        studentFullName: student ? null : studentFullName,
        targetCycleId: cycleId,
        targetEducationLevelId: educationLevelId,
        targetGradeLevelId: gradeLevelId,
        targetGroupId: groupId,
        campaignId,
        contacts: contacts.map((contact, index) => ({
          ...contact,
          relationship: contact.relationship === "Otro" ? contactOtherRelationships[index]?.trim() ?? "" : contact.relationship,
        })),
        notes: null,
      })

      if (!result.ok) return setError(result.message)
      toastManager.add({ title: "Alumno preinscrito correctamente", description: result.historical ? "El antecedente histórico quedó registrado." : "La preinscripción y su cargo quedaron registrados." })
      setError(null)
      setPayment(result.payment)
      setPaymentCompleted(false)
      setHistoricalPreregistration(result.historical ? result.historicalChargeStatus ?? "UNLINKED" : false)
      setStep(result.payment ? "payment" : "success")
      router.refresh()
    })
  }

  function stepError() {
    if (step === "student") {
      if (!isDate(preregisteredOn)) return "Captura una fecha de preinscripción válida."
      if (!student && (!isNewStudent || !studentFullName.trim())) return "Busca un alumno existente o captura el nombre de un alumno nuevo."
    }
    if (step === "destination") {
      if (!cycleId || !educationLevelId || !gradeLevelId || !groupId) return "Selecciona ciclo, nivel, grado y grupo."
      if (!campaignId) return applicableCampaigns.length ? "Selecciona una campaña aplicable." : "No hay una campaña aplicable para esa fecha, ciclo y nivel."
    }
    if (step === "contacts") {
      if (!contacts.length) return "Agrega al menos un contacto."
      if (contacts.length > 2) return "Solo puedes registrar un máximo de dos contactos."
      if (contacts.some((contact, index) => !contact.fullName.trim() || !contact.phone.trim() || !contact.relationship.trim() || (contact.relationship === "Otro" && !contactOtherRelationships[index]?.trim()))) return "Captura nombre, parentesco y teléfono de cada contacto."
    }
    return null
  }

  function updateContact(index: number, field: keyof PreregistrationIntakeContact, value: string) {
    setContacts((current) => current.map((contact, contactIndex) => contactIndex === index ? { ...contact, [field]: value } : contact))
  }

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset() }}><Dialog.Trigger render={<Button className="h-10"><UserPlus /> Preinscribir alumno</Button>} /><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" /><Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2"><header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6"><div className="min-w-0"><Dialog.Title className="text-base font-semibold">Preinscribir alumno</Dialog.Title>{step !== "success" && <p className="mt-0.5 text-xs text-muted-foreground">{stepLabel(step)}</p>}</div><Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"><X className="size-4" /></Dialog.Close></header><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{step === "student" && <StudentStep preregisteredOn={preregisteredOn} setPreregisteredOn={setPreregisteredOn} student={student} isLoadingStudent={isLoadingStudent} isNewStudent={isNewStudent} studentFullName={studentFullName} setStudentFullName={setStudentFullName} studentQuery={studentQuery} setStudentQuery={setStudentQuery} results={studentResults} state={studentSearchState} onSelect={selectStudent} onNew={startNewStudent} onSearchAgain={() => { setStudent(null); setIsNewStudent(false); setStudentQuery(""); setStudentResults([]); setStudentSearchState("idle"); setContacts([emptyContact()]); setContactOtherRelationships({}) }} />}{step === "destination" && <DestinationStep cycleId={cycleId} setCycleId={(value) => { setCycleId(value); setGradeLevelId(""); setGroupId(""); setCampaignId("") }} educationLevelId={educationLevelId} setEducationLevelId={(value) => { setEducationLevelId(value); setGradeLevelId(""); setGroupId(""); setCampaignId("") }} gradeLevelId={gradeLevelId} setGradeLevelId={(value) => { setGradeLevelId(value); setGroupId("") }} groupId={groupId} setGroupId={setGroupId} campaignId={campaignId} setCampaignId={setCampaignId} cycles={cycles} levels={levels} grades={availableGrades} groups={availableGroups} campaigns={applicableCampaigns} preregisteredOn={preregisteredOn} />}{step === "contacts" && <ContactsStep contacts={contacts} otherRelationships={contactOtherRelationships} onOtherChange={(index, value) => setContactOtherRelationships((current) => ({ ...current, [index]: value }))} onUpdate={updateContact} onAdd={() => setContacts((current) => current.length < 2 ? [...current, emptyContact()] : current)} onRemove={(index) => setContacts((current) => current.length > 1 ? current.filter((_, contactIndex) => contactIndex !== index) : current)} />}{step === "review" && <ReviewStep student={student} isNewStudent={isNewStudent} studentFullName={studentFullName} preregisteredOn={preregisteredOn} cycle={selectedCycle} level={selectedLevel} grade={selectedGrade} group={selectedGroup} campaign={selectedCampaign} contacts={contacts} />}{step === "payment" && <PaymentStep payment={payment} campaign={selectedCampaign} paymentFormContext={paymentFormContext} canReceiveForOthers={canReceiveForOthers} onRegister={() => setPaymentOpen(true)} onLater={() => setStep("success")} />}{step === "success" && <SuccessStep paid={paymentCompleted} historical={historicalPreregistration} />}</div>{error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}{step !== "success" && step !== "payment" && <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={step === "student" || isPending} onClick={back}><ChevronLeft /> Atrás</Button>{step === "review" ? <Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Confirmando..." : "Confirmar preinscripción"}</Button> : <Button disabled={isPending || (step === "student" && isLoadingStudent)} onClick={next}>Continuar</Button>}</footer>}{step === "success" && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="outline" disabled title="Pendiente de soporte de recibos">Imprimir recibo</Button><Button variant="outline" disabled title="Pendiente de soporte de correo">Enviar por correo</Button><Dialog.Close render={<Button>Cerrar</Button>} /></footer>}{payment && <RegisterPaymentSheet student={{ id: payment.studentId, fullName: payment.studentFullName, context: `Preinscripción · ${selectedCampaign?.name ?? "Campaña"}` }} charges={[payment.charge]} methods={paymentFormContext?.methods ?? []} receivers={paymentFormContext?.receivers ?? []} currentReceiverId={paymentFormContext?.currentReceiverId ?? null} canReceiveForOthers={canReceiveForOthers} disabledReason={paymentUnavailableReason(paymentFormContext, canReceiveForOthers)} open={paymentOpen} onOpenChange={(nextOpen) => { setPaymentOpen(nextOpen); if (!nextOpen && paymentCompleted) setStep("success") }} hideTrigger onPaymentRegistered={() => setPaymentCompleted(true)} />}</Dialog.Popup></Dialog.Portal></Dialog.Root>
}

function StudentStep(props: { preregisteredOn: string; setPreregisteredOn: (value: string) => void; student: PreregistrationIntakeStudentDetail | null; isLoadingStudent: boolean; isNewStudent: boolean; studentFullName: string; setStudentFullName: (value: string) => void; studentQuery: string; setStudentQuery: (value: string) => void; results: PreregistrationIntakeStudent[]; state: "idle" | "loading" | "error" | "empty"; onSelect: (student: PreregistrationIntakeStudent) => void; onNew: () => void; onSearchAgain: () => void }) {
  const enrollment = props.student?.latestEnrollment
  const destination = props.student?.suggestedDestination
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Datos del alumno</h2><p className="mt-1 text-sm text-muted-foreground">La fecha puede ser retroactiva. Busca un alumno real o registra uno nuevo.</p></div><Field label="Fecha de preinscripción"><Input type="date" value={props.preregisteredOn} onChange={(event) => props.setPreregisteredOn(event.target.value)} /></Field>{props.student ? <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{props.student.fullName}</p><p className="mt-1 text-xs text-muted-foreground">Alumno existente{props.student.studentCode ? ` · Matrícula: ${props.student.studentCode}` : ""}</p></div><Button variant="ghost" size="sm" onClick={props.onSearchAgain}>Cambiar</Button></div>{enrollment && <p className="text-xs text-muted-foreground">Contexto actual: {enrollment.cycle.name} · {enrollment.educationLevel.name} · {enrollment.gradeLevel.name}{enrollment.group ? ` · ${getEnrollmentGroupLabel(enrollment.group)}` : ""}</p>}{destination ? <p className="text-xs text-foreground">Destino sugerido: ciclo siguiente, {enrollment?.educationLevel.name} y grado siguiente{destination.groupId ? " · grupo sugerido" : " · selecciona grupo"}.</p> : enrollment && <p className="text-xs text-muted-foreground">No se pudo inferir un destino académico seguro; selecciónalo manualmente.</p>}{props.student.enrollmentHistory.length > 0 && <p className="text-xs text-muted-foreground">Historial: {props.student.enrollmentHistory.map((item) => `${item.cycleName} · ${statusLabel(item.status)}`).join(" | ")}</p>}</div> : props.isNewStudent ? <div className="space-y-3"><Field label="Nombre completo"><Input value={props.studentFullName} onChange={(event) => props.setStudentFullName(event.target.value)} placeholder="Nombre completo del alumno" /></Field><Button variant="ghost" size="sm" onClick={props.onSearchAgain}><ChevronLeft /> Buscar alumno existente</Button></div> : <><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={props.studentQuery} onChange={(event) => props.setStudentQuery(event.target.value)} placeholder="Buscar por nombre o matrícula..." className="h-11 bg-white pl-10" /></div><SearchResults results={props.results} state={props.state} onSelect={props.onSelect} />{props.state === "empty" && <Button variant="outline" onClick={props.onNew}><Plus /> Nuevo alumno</Button>}{props.isLoadingStudent && <p className="text-sm text-muted-foreground">Cargando datos del alumno...</p>}</>}</section>
}

function DestinationStep(props: { cycleId: string; setCycleId: (value: string) => void; educationLevelId: string; setEducationLevelId: (value: string) => void; gradeLevelId: string; setGradeLevelId: (value: string) => void; groupId: string; setGroupId: (value: string) => void; campaignId: string; setCampaignId: (value: string) => void; cycles: Cycle[]; levels: Level[]; grades: Grade[]; groups: Group[]; campaigns: PreregistrationCampaign[]; preregisteredOn: string }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Destino y campaña</h2><p className="mt-1 text-sm text-muted-foreground">La campaña debe ser aplicable al ciclo, nivel y fecha de preinscripción.</p></div><Field label="Ciclo destino"><select value={props.cycleId} onChange={(event) => props.setCycleId(event.target.value)} className={selectClass}>{props.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></Field><Field label="Nivel educativo"><select value={props.educationLevelId} onChange={(event) => props.setEducationLevelId(event.target.value)} className={selectClass}><option value="">Selecciona un nivel</option>{props.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field><Field label="Grado"><select value={props.gradeLevelId} onChange={(event) => props.setGradeLevelId(event.target.value)} disabled={!props.educationLevelId} className={selectClass}><option value="">Selecciona un grado</option>{props.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field><Field label="Grupo"><select value={props.groupId} onChange={(event) => props.setGroupId(event.target.value)} disabled={!props.gradeLevelId} className={selectClass}><option value="">Selecciona un grupo</option>{props.groups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field>{props.cycleId && props.educationLevelId && <Field label="Campaña"><select value={props.campaignId} onChange={(event) => props.setCampaignId(event.target.value)} className={selectClass}><option value="">Selecciona una campaña</option>{props.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {formatDate(campaign.startsOn)} - {formatDate(campaign.endsOn)} · {formatCurrency(campaign.price)}</option>)}</select>{!props.campaigns.length && <p className="text-sm text-destructive">No hay una campaña aplicable para esa fecha, ciclo y nivel.</p>}</Field>}</section>
}

function ContactsStep({ contacts, otherRelationships, onOtherChange, onUpdate, onAdd, onRemove }: { contacts: PreregistrationIntakeContact[]; otherRelationships: Record<number, string>; onOtherChange: (index: number, value: string) => void; onUpdate: (index: number, field: keyof PreregistrationIntakeContact, value: string) => void; onAdd: () => void; onRemove: (index: number) => void }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Contactos</h2><p className="mt-1 text-sm text-muted-foreground">Registra entre uno y dos contactos. Los datos existentes pueden corregirse.</p></div>{contacts.map((contact, index) => { const relationshipValue = isGuardianRelationship(contact.relationship) ? contact.relationship : contact.relationship ? "Otro" : ""; return <div key={contact.guardianId ?? index} className="space-y-4 rounded-lg border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Contacto {index + 1}</p>{contacts.length > 1 && <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>Quitar</Button>}</div><Field label="Nombre"><Input value={contact.fullName} onChange={(event) => onUpdate(index, "fullName", event.target.value)} /></Field><Field label="Teléfono"><Input value={contact.phone} onChange={(event) => onUpdate(index, "phone", event.target.value)} inputMode="tel" /></Field><Field label="Correo"><Input value={contact.email} onChange={(event) => onUpdate(index, "email", event.target.value)} type="email" /></Field><Field label="Parentesco"><select value={relationshipValue} onChange={(event) => onUpdate(index, "relationship", event.target.value === "Otro" ? "Otro" : event.target.value)} className={selectClass}><option value="">Selecciona un parentesco</option>{GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></Field>{relationshipValue === "Otro" && <Field label="Especificar parentesco"><Input value={otherRelationships[index] ?? ""} onChange={(event) => { onOtherChange(index, event.target.value); onUpdate(index, "relationship", "Otro") }} /></Field>}</div>})}{contacts.length < 2 && <Button variant="outline" onClick={onAdd}><Plus /> Agregar segundo contacto</Button>}</section>
}

function ReviewStep({ student, isNewStudent, studentFullName, preregisteredOn, cycle, level, grade, group, campaign, contacts }: { student: PreregistrationIntakeStudentDetail | null; isNewStudent: boolean; studentFullName: string; preregisteredOn: string; cycle: Cycle | null; level: Level | null; grade: Grade | null; group: Group | null; campaign: PreregistrationCampaign | null; contacts: PreregistrationIntakeContact[] }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Verificar preinscripción</h2><p className="mt-1 text-sm text-muted-foreground">Revisa la información antes de confirmar.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={student?.fullName ?? studentFullName} /><Summary label="Registro" value={student ? `Alumno existente${student.studentCode ? ` · ${student.studentCode}` : ""}` : isNewStudent ? "Alumno nuevo" : ""} /><Summary label="Fecha de preinscripción" value={formatDate(preregisteredOn)} /><Summary label="Ciclo" value={cycle?.name ?? ""} /><Summary label="Nivel" value={level?.name ?? ""} /><Summary label="Grado y grupo" value={`${grade?.name ?? ""}${group ? ` · ${getEnrollmentGroupLabel(group)}` : ""}`} /><Summary label="Campaña" value={campaign?.name ?? ""} /><Summary label="Vigencia" value={campaign ? `${formatDate(campaign.startsOn)} - ${formatDate(campaign.endsOn)}` : ""} /><Summary label="Precio" value={campaign ? formatCurrency(campaign.price) : ""} /></dl><section className="space-y-2"><h3 className="text-sm font-semibold">Contactos</h3>{contacts.map((contact, index) => <div key={contact.guardianId ?? index} className="rounded-lg border border-border px-3 py-2 text-sm"><p className="font-medium">{contact.fullName}</p><p className="mt-1 text-muted-foreground">{contact.relationship || "Contacto"} · {contact.phone}{contact.email ? ` · ${contact.email}` : ""}</p></div>)}</section></section>
}

function PaymentStep({ payment, campaign, paymentFormContext, canReceiveForOthers, onRegister, onLater }: { payment: PreregistrationPaymentContext | null; campaign: PreregistrationCampaign | null; paymentFormContext: PaymentFormContext | null; canReceiveForOthers: boolean; onRegister: () => void; onLater: () => void }) { if (!payment) return <section className="py-8 text-center"><p className="font-medium">No pudimos cargar el cargo de preinscripción.</p><p className="mt-2 text-sm text-muted-foreground">La preinscripción quedó registrada; consulta la cuenta del alumno para registrar el pago.</p><Button className="mt-5" onClick={onLater}>Finalizar</Button></section>; const disabledReason = paymentUnavailableReason(paymentFormContext, canReceiveForOthers); return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Registrar pago</h2><p className="mt-1 text-sm text-muted-foreground">La preinscripción ya quedó registrada. Puedes cobrar ahora o hacerlo después.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={payment.studentFullName} /><Summary label="Campaña" value={campaign?.name ?? ""} /><Summary label="Monto de preinscripción" value={formatCurrency(Number(payment.charge.effectiveAmount))} /><Summary label="Saldo pendiente" value={formatCurrency(Number(payment.charge.outstandingAmount))} /></dl>{disabledReason && <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{disabledReason}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onLater}>Registrar pago después</Button><Button disabled={Boolean(disabledReason)} onClick={onRegister}>Registrar pago</Button></div></section> }
function SuccessStep({ paid, historical }: { paid: boolean; historical: false | "PENDING" | "COVERED" | "UNLINKED" | "REVIEW" }) { const historicalStatus = historical || null; const message = paid ? "El pago se registró y aplicó al cargo de preinscripción." : historicalStatus === "COVERED" ? "La inscripción ya está cubierta. No se ofreció otro cobro." : historicalStatus === "UNLINKED" || historicalStatus === "REVIEW" ? "La preinscripción fue registrada, pero no se encontró una obligación financiera inequívoca para vincular. Requiere revisión financiera." : historicalStatus ? "El antecedente histórico quedó registrado sobre la matrícula existente. No se generó un cargo nuevo." : "La preinscripción y el cargo de campaña quedaron registrados."; return <section className="py-8 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h2 className="mt-4 text-lg font-semibold">Alumno preinscrito correctamente</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p>{!historicalStatus && <p className="mt-4 text-xs text-muted-foreground">La impresión y el envío por correo estarán disponibles cuando exista soporte operativo para recibos.</p>}</section> }
function SearchResults({ results, state, onSelect }: { results: PreregistrationIntakeStudent[]; state: "idle" | "loading" | "error" | "empty"; onSelect: (student: PreregistrationIntakeStudent) => void }) { if (state === "loading") return <p className="rounded-lg border border-border px-3 py-3 text-sm text-muted-foreground">Buscando alumnos...</p>; if (state === "error") return <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive">No pudimos buscar alumnos. Inténtalo de nuevo.</p>; if (state === "empty") return <p className="rounded-lg border border-border px-3 py-3 text-sm text-muted-foreground">No encontramos alumnos existentes con esa búsqueda.</p>; if (!results.length) return null; return <div className="overflow-hidden rounded-lg border border-border">{results.map((result) => <button key={result.id} type="button" onClick={() => onSelect(result)} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span className="min-w-0"><span className="block truncate text-sm font-medium">{result.fullName}</span>{result.studentCode && <span className="mt-0.5 block text-xs text-muted-foreground">Matrícula: {result.studentCode}</span>}</span><span className="shrink-0 text-xs text-muted-foreground">Seleccionar</span></button>)}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || "Sin dato"}</dd></div> }
function nextStep(step: Step): Step { return ({ student: "destination", destination: "contacts", contacts: "review" } as const)[step as "student" | "destination" | "contacts"] ?? step }
function previousStep(step: Step): Step { return ({ destination: "student", contacts: "destination", review: "contacts" } as const)[step as "destination" | "contacts" | "review"] ?? step }
function stepLabel(step: Exclude<Step, "success">) { return ({ student: "Paso 1 de 5 · Alumno", destination: "Paso 2 de 5 · Destino y campaña", contacts: "Paso 3 de 5 · Contactos", review: "Paso 4 de 5 · Verificar", payment: "Paso 5 de 5 · Pago" } as const)[step] }
function statusLabel(status: string) { return ({ ACTIVA: "Activa", BAJA: "Baja", FINALIZADA: "Finalizada", PREINSCRITA: "Preinscrita", NO_CONTINUA: "No continúa", EGRESADA: "Egresada" } as Record<string, string>)[status] ?? status }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) }
function dateInput(date: Date) { return date.toISOString().slice(0, 10) }
function formatDate(value: string) { return isDate(value) ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Sin definir" }
function formatCurrency(value: number) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value) }
const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted"
function paymentUnavailableReason(context: PaymentFormContext | null, canReceiveForOthers: boolean) { if (!context) return "No pudimos cargar las opciones de pago. Inténtalo de nuevo."; if (!context.methods.length) return "No hay métodos de pago activos disponibles."; if (!canReceiveForOthers && !context.currentReceiverId) return "No hay un receptor autorizado vinculado a tu usuario."; if (!context.receivers.length) return "No hay receptores activos disponibles."; return undefined }
