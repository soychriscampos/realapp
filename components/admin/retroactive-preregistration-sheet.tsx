"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, ChevronLeft, History, LoaderCircle, Search, X } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import {
  createRetroactivePreregistration,
  searchRetroactivePreregistrationStudents,
  type RetroactivePreregistrationStudent,
} from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getEnrollmentGroupLabel } from "@/lib/admin/enrollments"
import type { PreregistrationCampaign } from "@/lib/admin/preregistration-campaigns"

type Grade = { id: string; name: string; education_level_id: string }
type Group = { id: string; name: string; code: string; cycle_id: string; grade_level_id: string }
type Step = "form" | "review" | "success"

export function RetroactivePreregistrationSheet({ campaigns, grades, groups }: { campaigns: PreregistrationCampaign[]; grades: Grade[]; groups: Group[] }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [preregisteredOn, setPreregisteredOn] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [studentQuery, setStudentQuery] = useState("")
  const [studentResults, setStudentResults] = useState<RetroactivePreregistrationStudent[]>([])
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error" | "empty">("idle")
  const [student, setStudent] = useState<RetroactivePreregistrationStudent | null>(null)
  const [gradeLevelId, setGradeLevelId] = useState("")
  const [groupId, setGroupId] = useState("")
  const [notes, setNotes] = useState("")
  const [linkedCharge, setLinkedCharge] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastManager = Toast.useToastManager()

  const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId) ?? null
  const applicableCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.status !== "CANCELLED" && isDate(preregisteredOn) && preregisteredOn >= campaign.startsOn && preregisteredOn <= campaign.endsOn), [campaigns, preregisteredOn])
  const availableGrades = selectedCampaign?.educationLevelId ? grades.filter((grade) => grade.education_level_id === selectedCampaign.educationLevelId) : grades
  const availableGroups = selectedCampaign ? groups.filter((group) => group.cycle_id === selectedCampaign.targetCycleId && group.grade_level_id === gradeLevelId) : []

  useEffect(() => {
    const term = studentQuery.trim()
    if (!selectedCampaign || student || term.length < 2) return
    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setSearchState("loading")
      const result = await searchRetroactivePreregistrationStudents({ campaignId: selectedCampaign.id, term })
      if (cancelled) return
      setStudentResults(result.error ? [] : result.data)
      setSearchState(result.error ? "error" : result.data.length ? "idle" : "empty")
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [selectedCampaign, student, studentQuery])

  function reset() {
    setStep("form")
    setPreregisteredOn("")
    setCampaignId("")
    setStudentQuery("")
    setStudentResults([])
    setSearchState("idle")
    setStudent(null)
    setGradeLevelId("")
    setGroupId("")
    setNotes("")
    setLinkedCharge(null)
    setError(null)
  }

  function selectStudent(result: RetroactivePreregistrationStudent) {
    setStudent(result)
    setStudentQuery(result.fullName)
    setStudentResults([])
    setSearchState("idle")
    setGradeLevelId(result.enrollment.gradeLevelId)
    setGroupId(result.enrollment.groupId ?? "")
    setError(null)
  }

  function review() {
    const message = validate()
    if (message) return setError(message)
    setError(null)
    setStep("review")
  }

  function submit() {
    const message = validate()
    if (message || !student) return setError(message ?? "Selecciona un alumno.")
    startTransition(async () => {
      const result = await createRetroactivePreregistration({ studentId: student.id, campaignId, preregisteredOn, targetGradeLevelId: gradeLevelId, targetGroupId: groupId, notes: notes || null })
      if (!result.ok) return setError(result.message)
      setLinkedCharge(result.linkedCharge)
      setStep("success")
      setError(null)
      toastManager.add({ title: "Preinscripción retroactiva registrada", description: "La matrícula actual no se modificó." })
    })
  }

  function validate() {
    if (!isDate(preregisteredOn)) return "Captura una fecha real de preinscripción válida."
    if (!campaignId) return applicableCampaigns.length ? "Selecciona una campaña aplicable." : "No hay campañas aplicables para la fecha seleccionada."
    if (!student) return "Busca y selecciona un alumno con matrícula en el ciclo destino."
    if (!gradeLevelId || !groupId) return "Selecciona grado y grupo destino."
    return null
  }

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset() }}><Dialog.Trigger render={<Button variant="outline" className="h-10"><History /> Registrar preinscripción retroactiva</Button>} /><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" /><Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2"><header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6"><div><Dialog.Title className="text-base font-semibold">Preinscripción retroactiva</Dialog.Title><p className="mt-0.5 text-xs text-muted-foreground">Reconstruye el antecedente sin modificar la matrícula actual.</p></div><Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close></header><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{step === "form" && <section className="space-y-5"><Field label="Fecha real de preinscripción"><Input type="date" value={preregisteredOn} onChange={(event) => { setPreregisteredOn(event.target.value); setCampaignId(""); setStudent(null); setStudentQuery("") }} /></Field><Field label="Campaña"><select value={campaignId} onChange={(event) => { setCampaignId(event.target.value); setStudent(null); setStudentQuery(""); setGradeLevelId(""); setGroupId("") }} className={selectClass}><option value="">Selecciona una campaña</option>{applicableCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.targetCycleName} · {formatDate(campaign.startsOn)} - {formatDate(campaign.endsOn)}</option>)}</select>{isDate(preregisteredOn) && !applicableCampaigns.length && <p className="text-sm text-destructive">No hay campañas aplicables para la fecha seleccionada.</p>}</Field>{selectedCampaign && <><Field label="Alumno">{student ? <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3"><div><p className="font-medium">{student.fullName}</p><p className="mt-1 text-xs text-muted-foreground">{student.studentCode ? `Matrícula: ${student.studentCode}` : "Alumno existente"} · Matrícula desde {formatDate(student.enrollment.enrolledOn)}</p></div><Button variant="ghost" size="sm" onClick={() => { setStudent(null); setStudentQuery(""); setGradeLevelId(""); setGroupId("") }}>Cambiar</Button></div> : <><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={studentQuery} onChange={(event) => { setStudentQuery(event.target.value); setStudentResults([]); setSearchState("idle") }} placeholder="Buscar por nombre o matrícula..." className="h-11 bg-white pl-10" /></div><RetroactiveStudentResults results={studentResults} state={searchState} onSelect={selectStudent} /></>}</Field><Field label="Grado destino"><select value={gradeLevelId} onChange={(event) => { setGradeLevelId(event.target.value); setGroupId("") }} className={selectClass}><option value="">Selecciona un grado</option>{availableGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field><Field label="Grupo destino"><select value={groupId} onChange={(event) => setGroupId(event.target.value)} disabled={!gradeLevelId} className={selectClass}><option value="">Selecciona un grupo</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{getEnrollmentGroupLabel(group)}</option>)}</select></Field><Field label="Notas"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" rows={3} /></Field></>}</section>}{step === "review" && student && <section className="space-y-5"><Button variant="ghost" className="-ml-2" disabled={isPending} onClick={() => setStep("form")}><ChevronLeft /> Volver</Button><div><h2 className="text-lg font-semibold">Verificar registro histórico</h2><p className="mt-1 text-sm text-muted-foreground">La matrícula actual permanecerá sin cambios.</p></div><dl className="divide-y divide-border border-y border-border"><Summary label="Alumno" value={student.fullName} /><Summary label="Campaña" value={selectedCampaign?.name ?? ""} /><Summary label="Fecha de preinscripción" value={formatDate(preregisteredOn)} /><Summary label="Grado" value={grades.find((grade) => grade.id === gradeLevelId)?.name ?? ""} /><Summary label="Grupo" value={getEnrollmentGroupLabel(groups.find((group) => group.id === groupId) ?? { id: "", name: "", code: "", cycle_id: "", grade_level_id: "" })} /><Summary label="Notas" value={notes || "Sin notas"} /></dl></section>}{step === "success" && <section className="py-8 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h2 className="mt-4 text-lg font-semibold">Preinscripción retroactiva registrada</h2><p className="mt-2 text-sm text-muted-foreground">La matrícula actual no se modificó.</p><p className="mt-3 text-sm text-muted-foreground">{linkedCharge ? "Se vinculó el cargo de inscripción existente." : "No se encontró un cargo de inscripción inequívoco; no se creó deuda ni pago automáticamente."}</p></section>}</div>{error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}{step === "form" && <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button onClick={review}>Revisar</Button></footer>}{step === "review" && <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Registrando..." : "Confirmar registro"}</Button></footer>}{step === "success" && <footer className="flex justify-end border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close render={<Button>Cerrar</Button>} /></footer>}</Dialog.Popup></Dialog.Portal></Dialog.Root>
}

function RetroactiveStudentResults({ results, state, onSelect }: { results: RetroactivePreregistrationStudent[]; state: "idle" | "loading" | "error" | "empty"; onSelect: (student: RetroactivePreregistrationStudent) => void }) { if (state === "loading") return <p className="rounded-lg border border-border px-3 py-3 text-sm text-muted-foreground">Buscando alumnos...</p>; if (state === "error") return <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive">No pudimos buscar alumnos. Inténtalo de nuevo.</p>; if (state === "empty") return <p className="rounded-lg border border-border px-3 py-3 text-sm text-muted-foreground">No hay alumnos con matrícula en el ciclo destino de esta campaña.</p>; if (!results.length) return null; return <div className="overflow-hidden rounded-lg border border-border">{results.map((result) => <button key={result.id} type="button" onClick={() => onSelect(result)} className="block min-h-14 w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted"><span className="block text-sm font-medium">{result.fullName}</span><span className="mt-1 block text-xs text-muted-foreground">{result.studentCode ? `Matrícula: ${result.studentCode} · ` : ""}Matriculado desde {formatDate(result.enrollment.enrolledOn)}</span></button>)}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || "Sin dato"}</dd></div> }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) }
function formatDate(value: string) { return isDate(value) ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Sin definir" }
const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted"
