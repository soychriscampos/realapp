"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import { Toast } from "@base-ui/react/toast"
import { Ellipsis, LoaderCircle, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createSchoolCycleGroup, setSchoolCycleGroupActive, updateSchoolCycleGroup } from "@/app/admin/configuracion/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SchoolCycleGroup } from "@/lib/admin/school-cycles"

export function SchoolCycleGroupSheet({ cycleId, gradeLevelId, gradeName, group }: { cycleId: string; gradeLevelId: string; gradeName: string; group?: SchoolCycleGroup }) {
  const isEdit = Boolean(group)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<"edit" | "status" | "create">(group ? "edit" : "create")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  function openAction(nextAction: "edit" | "status" | "create") {
    setAction(nextAction)
    setCode(group?.code ?? "")
    setName(group?.name ?? `${gradeName} ${group?.code ?? ""}`.trim())
    setError(null)
    setOpen(true)
  }

  function submit() {
    if (action !== "status" && (!code.trim() || !name.trim())) {
      setError("Indica un código y un nombre para el grupo.")
      return
    }

    startTransition(async () => {
      const result = action === "create"
        ? await createSchoolCycleGroup({ cycleId, gradeLevelId, code, name })
        : action === "edit" && group
          ? await updateSchoolCycleGroup({ groupId: group.id, cycleId, gradeLevelId, code, name })
          : group
            ? await setSchoolCycleGroupActive({ groupId: group.id, cycleId, gradeLevelId, isActive: !group.isActive })
            : { ok: false as const, message: "No encontramos el grupo seleccionado." }

      if (!result.ok) {
        setError(result.message)
        return
      }
      toastManager.add({ title: action === "create" ? "Grupo creado" : action === "edit" ? "Grupo actualizado" : group?.isActive ? "Grupo desactivado" : "Grupo activado", description: "La configuración se actualizó correctamente." })
      setOpen(false)
      router.refresh()
    })
  }

  return <>
    {isEdit ? <Menu.Root><Menu.Trigger aria-label={`Acciones de ${group?.name}`} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Ellipsis className="size-4" /></Menu.Trigger><Menu.Portal><Menu.Positioner align="end" sideOffset={6}><Menu.Popup className="z-50 min-w-44 rounded-xl border border-border bg-white p-1 shadow-lg"><Menu.Item onClick={() => openAction("edit")} className="flex h-9 items-center rounded-lg px-2 text-sm hover:bg-muted">Editar grupo</Menu.Item><Menu.Item onClick={() => openAction("status")} className="flex h-9 items-center rounded-lg px-2 text-sm hover:bg-muted">{group?.isActive ? "Desactivar" : "Activar"}</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root> : <Button variant="outline" size="sm" onClick={() => openAction("create")}><Plus /> Agregar grupo</Button>}
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isPending) { setOpen(false); setError(null) } }}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" /><Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2"><header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6"><div><Dialog.Title className="text-base font-semibold">{action === "create" ? "Agregar grupo" : action === "status" ? "Cambiar estado" : "Editar grupo"}</Dialog.Title><p className="mt-0.5 text-xs text-muted-foreground">{gradeName}</p></div><Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></Dialog.Close></header><div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{action === "status" ? <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Grupo</span><span className="mt-1 block font-semibold">{group?.name}</span><span className="mt-1 block text-muted-foreground">Estado nuevo: {group?.isActive ? "Inactivo" : "Activo"}</span></div> : <section className="space-y-5"><Field label="Código"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej. A" /></Field><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Ej. ${gradeName} A`} /></Field></section>}</div>{error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}<footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Guardando..." : action === "status" ? group?.isActive ? "Desactivar" : "Activar" : action === "edit" ? "Guardar cambios" : "Crear grupo"}</Button></footer></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}
