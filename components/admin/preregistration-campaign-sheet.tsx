"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { CalendarDays, ChevronLeft, LoaderCircle, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createPreregistrationCampaign } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PreregistrationCampaign } from "@/lib/admin/preregistration-campaigns"

type CampaignSheetProps = {
  campaigns: PreregistrationCampaign[]
  loadError: boolean
  cycles: Array<{ id: string; name: string }>
  levels: Array<{ id: string; name: string }>
  operationalCycleId?: string
}

export function PreregistrationCampaignSheet({
  campaigns,
  loadError,
  cycles,
  levels,
  operationalCycleId,
}: CampaignSheetProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"list" | "create">("list")
  const [name, setName] = useState("")
  const [targetCycleId, setTargetCycleId] = useState(operationalCycleId ?? cycles[0]?.id ?? "")
  const [educationLevelId, setEducationLevelId] = useState("")
  const [startsOn, setStartsOn] = useState(dateInput(new Date()))
  const [endsOn, setEndsOn] = useState(dateInput(new Date()))
  const [price, setPrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  function resetForm() {
    setName("")
    setTargetCycleId(operationalCycleId ?? cycles[0]?.id ?? "")
    setEducationLevelId("")
    setStartsOn(dateInput(new Date()))
    setEndsOn(dateInput(new Date()))
    setPrice("")
    setError(null)
  }

  function close() {
    if (isPending) return
    setOpen(false)
    setView("list")
    setError(null)
  }

  function beginCreate() {
    resetForm()
    setView("create")
  }

  function submit() {
    const validationMessage = validate({ name, targetCycleId, startsOn, endsOn, price })
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    startTransition(async () => {
      const result = await createPreregistrationCampaign({
        targetCycleId,
        educationLevelId: educationLevelId || null,
        name,
        startsOn,
        endsOn,
        price,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({
        title: "Campaña creada",
        description: "La campaña ya está disponible para preinscripciones.",
      })
      setView("list")
      setError(null)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" className="h-10" onClick={() => setOpen(true)}><CalendarDays /> Campañas de preinscripción</Button>

      <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
          <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
            <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold">{view === "list" ? "Campañas de preinscripción" : "Nueva campaña"}</Dialog.Title>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{view === "list" ? "Configuración de campañas por ciclo escolar" : "Los cambios posteriores se gestionan desde su historial."}</p>
              </div>
              <Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"><X className="size-4" /></Dialog.Close>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
              {view === "list" ? (
                <CampaignList campaigns={campaigns} loadError={loadError} onCreate={beginCreate} />
              ) : view === "create" ? (
                <section className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><h2 className="text-lg font-semibold">Datos de la campaña</h2><p className="mt-1 text-sm text-muted-foreground">Las fechas pueden ser anteriores o estar en curso.</p></div>
                    <Button variant="ghost" className="shrink-0" disabled={isPending} onClick={() => { setView("list"); setError(null) }}><ChevronLeft /> Volver</Button>
                  </div>
                  <Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Preinscripción Primaria 2027" /></Field>
                  <Field label="Ciclo destino"><select value={targetCycleId} onChange={(event) => setTargetCycleId(event.target.value)} className={selectClass}>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></Field>
                  <Field label="Nivel educativo"><select value={educationLevelId} onChange={(event) => setEducationLevelId(event.target.value)} className={selectClass}><option value="">Todos los niveles</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
                  <div className="grid gap-5 sm:grid-cols-2"><Field label="Fecha de inicio"><Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></Field><Field label="Fecha de fin"><Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></Field></div>
                  <Field label="Precio"><Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></Field>
                </section>
              ) : null}
            </div>
            {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
            {view === "create" && <footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={() => { setView("list"); setError(null) }}>Cancelar</Button><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Creando..." : "Crear campaña"}</Button></footer>}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function CampaignList({ campaigns, loadError, onCreate }: { campaigns: PreregistrationCampaign[]; loadError: boolean; onCreate: () => void }) {
  if (loadError) return <div className="space-y-4"><p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">No pudimos cargar las campañas de preinscripción. Inténtalo de nuevo.</p><Button onClick={onCreate}><Plus /> Nueva campaña</Button></div>

  return <section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Campañas</h2><p className="mt-1 text-sm text-muted-foreground">{campaigns.length === 1 ? "1 campaña configurada" : `${campaigns.length} campañas configuradas`}</p></div><Button onClick={onCreate}><Plus /> Nueva campaña</Button></div>{campaigns.length === 0 ? <div className="border-y border-border py-10 text-center"><p className="font-medium">Aún no hay campañas.</p><p className="mt-1 text-sm text-muted-foreground">Crea una campaña para preparar las preinscripciones del ciclo.</p></div> : <div className="divide-y divide-border border-y border-border">{campaigns.map((campaign) => <article key={campaign.id} className="space-y-3 py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{campaign.name}</h3><p className="mt-1 text-sm text-muted-foreground">{campaign.targetCycleName} · {campaign.educationLevelName ?? "Todos los niveles"}</p></div><Status status={campaign.status} /></div><dl className="grid gap-3 text-sm sm:grid-cols-2"><Detail label="Periodo" value={`${formatDate(campaign.startsOn)} - ${formatDate(campaign.endsOn)}`} /><Detail label="Precio" value={formatCurrency(campaign.price)} /></dl></article>)}</div>}</section>
}

function Status({ status }: { status: PreregistrationCampaign["status"] }) {
  const label = { DRAFT: "Borrador", ACTIVE: "Activa", CLOSED: "Cerrada", CANCELLED: "Cancelada" }[status]
  const color = status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : status === "DRAFT" ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-800"
  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}

function validate(values: { name: string; targetCycleId: string; startsOn: string; endsOn: string; price: string }) {
  if (!values.name.trim()) return "Indica un nombre para la campaña."
  if (!values.targetCycleId) return "Selecciona un ciclo destino válido."
  if (![values.startsOn, values.endsOn].every(isDate)) return "Captura fechas válidas para la campaña."
  if (values.endsOn < values.startsOn) return "La fecha de fin debe ser igual o posterior a la fecha de inicio."
  if (!values.price.trim() || !Number.isFinite(Number(values.price)) || Number(values.price) < 0) return "El precio debe ser cero o mayor."
  return null
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
}

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
