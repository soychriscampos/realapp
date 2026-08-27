"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import { Toast } from "@base-ui/react/toast"
import { Ellipsis, LoaderCircle, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { activateSchoolCycle, createSchoolCycle, updateSchoolCycle } from "@/app/admin/configuracion/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SchoolCycle } from "@/lib/admin/school-cycles"

type Action = "create" | "edit" | "activate"

export function SchoolCycleSheet({ cycle }: { cycle?: SchoolCycle }) {
  const isEdit = Boolean(cycle)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<Action>(cycle ? "edit" : "create")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  function reset(nextAction: Action) {
    setAction(nextAction)
    setCode(cycle?.code ?? "")
    setName(cycle?.name ?? "")
    setStartsOn(cycle?.startsOn ?? "")
    setEndsOn(cycle?.endsOn ?? "")
    setError(null)
  }

  function openAction(nextAction: Action) {
    reset(nextAction)
    setOpen(true)
  }

  function submit() {
    if (action !== "activate") {
      const validationMessage = validate({ code, name, startsOn, endsOn })
      if (validationMessage) {
        setError(validationMessage)
        return
      }
    }

    startTransition(async () => {
      const result = action === "create"
        ? await createSchoolCycle({ code, name, startsOn, endsOn })
        : action === "edit" && cycle
          ? await updateSchoolCycle({ cycleId: cycle.id, code, name, startsOn, endsOn })
          : cycle
            ? await activateSchoolCycle({ cycleId: cycle.id })
            : { ok: false as const, message: "No encontramos el ciclo seleccionado." }

      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({
        title: action === "create" ? "Ciclo creado" : action === "edit" ? "Ciclo actualizado" : "Ciclo activado",
        description: action === "activate" ? "Ahora es el ciclo operativo." : "La configuración se actualizó correctamente.",
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {isEdit ? (
        <Menu.Root>
          <Menu.Trigger aria-label={`Acciones de ${cycle?.name}`} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"><Ellipsis className="size-4" /></Menu.Trigger>
          <Menu.Portal><Menu.Positioner align="end" sideOffset={6}><Menu.Popup className="z-50 min-w-48 rounded-xl border border-border bg-white p-1 shadow-lg outline-none"><Menu.Item onClick={() => openAction("edit")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Editar datos</Menu.Item>{cycle?.status === "PREPARATION" && <Menu.Item onClick={() => openAction("activate")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Activar ciclo</Menu.Item>}</Menu.Popup></Menu.Positioner></Menu.Portal>
        </Menu.Root>
      ) : <Button onClick={() => openAction("create")} className="h-10"><Plus /> Nuevo ciclo escolar</Button>}

      <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isPending) { setOpen(false); setError(null) } }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
          <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
            <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6"><div className="min-w-0"><Dialog.Title className="text-base font-semibold">{title(action)}</Dialog.Title><p className="mt-0.5 truncate text-xs text-muted-foreground">{cycle?.name ?? "Configuración escolar"}</p></div><Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"><X className="size-4" /></Dialog.Close></header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"><section className="space-y-5"><div><h2 className="text-lg font-semibold">{action === "activate" ? "Activar ciclo escolar" : action === "edit" ? "Editar datos" : "Datos del ciclo escolar"}</h2><p className="mt-1 text-sm text-muted-foreground">{action === "activate" ? "Solo puede existir un ciclo activo a la vez." : action === "create" ? "El ciclo se creará en estado Preparación." : "Actualiza los datos básicos del ciclo."}</p></div>{action === "activate" ? <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Ciclo seleccionado</span><span className="mt-1 block font-semibold">{cycle?.name}</span><span className="mt-1 block text-muted-foreground">Estado nuevo: Activo</span></div> : <><Field label="Código"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej. 27-28" /></Field><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Ciclo Escolar 27-28" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha de inicio"><Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></Field><Field label="Fecha de fin"><Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></Field></div></>}</section></div>
            {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
            <footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Guardando..." : action === "activate" ? "Activar ciclo" : action === "edit" ? "Guardar cambios" : "Crear ciclo"}</Button></footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function title(action: Action) {
  return action === "create" ? "Nuevo ciclo escolar" : action === "edit" ? "Editar ciclo escolar" : "Activar ciclo escolar"
}

function validate(input: { code: string; name: string; startsOn: string; endsOn: string }) {
  if (!input.code.trim()) return "Indica un código para el ciclo escolar."
  if (!input.name.trim()) return "Indica un nombre para el ciclo escolar."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) return "Captura fechas válidas."
  if (input.endsOn < input.startsOn) return "La fecha de fin debe ser posterior o igual a la fecha de inicio."
  return null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}
