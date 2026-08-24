"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import { Toast } from "@base-ui/react/toast"
import { Ellipsis, LoaderCircle, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  changeTuitionDiscountCategoryVersion,
  createTuitionDiscountCategory,
  renameTuitionDiscountCategory,
  setTuitionDiscountCategoryActive,
} from "@/app/admin/configuracion/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"

type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT"
type Action = "create" | "change" | "rename" | "status"

export function TuitionDiscountCategorySheet({ cycleId, category }: { cycleId: string; category?: TuitionDiscountCategory }) {
  const isEdit = Boolean(category)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<Action>(category ? "change" : "create")
  const [name, setName] = useState("")
  const [discountType, setDiscountType] = useState<DiscountType>("FIXED_AMOUNT")
  const [value, setValue] = useState("")
  const [effectiveOn, setEffectiveOn] = useState(dateInput(new Date()))
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  function reset(nextAction: Action) {
    setAction(nextAction)
    setName(category?.name ?? "")
    setDiscountType(category?.discountType ?? "FIXED_AMOUNT")
    setValue(category?.currentVersion?.value.toString() ?? "")
    setEffectiveOn(category?.currentVersion?.validFrom ?? dateInput(new Date()))
    setReason("")
    setError(null)
  }

  function openAction(nextAction: Action) {
    reset(nextAction)
    setOpen(true)
  }

  function submit() {
    const validationMessage = validate({ action, name, value, effectiveOn, reason, discountType, isEdit })
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    startTransition(async () => {
      const result = action === "create"
        ? await createTuitionDiscountCategory({ cycleId, name, discountType, value, effectiveOn, reason })
        : action === "change" && category
          ? await changeTuitionDiscountCategoryVersion({ categoryId: category.id, discountType: category.discountType, value, effectiveOn, currentVersionValidFrom: category.currentVersion?.validFrom ?? null, reason })
          : action === "rename" && category
            ? await renameTuitionDiscountCategory({ categoryId: category.id, name, reason })
            : category
              ? await setTuitionDiscountCategoryActive({ categoryId: category.id, isActive: !category.isActive, reason })
              : { ok: false as const, message: "No encontramos la categoría seleccionada." }

      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({
        title: action === "create" ? "Categoría creada" : action === "change" ? "Valor actualizado" : action === "rename" ? "Categoría renombrada" : category?.isActive ? "Categoría desactivada" : "Categoría reactivada",
        description: action === "change" ? "Se conservó el historial de versiones." : "La configuración se actualizó correctamente.",
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {isEdit ? (
        <Menu.Root>
          <Menu.Trigger aria-label={`Acciones de ${category?.name}`} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"><Ellipsis className="size-4" /></Menu.Trigger>
          <Menu.Portal><Menu.Positioner align="end" sideOffset={6}><Menu.Popup className="z-50 min-w-48 rounded-xl border border-border bg-white p-1 shadow-lg outline-none"><Menu.Item onClick={() => openAction("change")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Cambiar valor</Menu.Item><Menu.Item onClick={() => openAction("rename")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Renombrar</Menu.Item><Menu.Item onClick={() => openAction("status")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">{category?.isActive ? "Desactivar" : "Reactivar"}</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal>
        </Menu.Root>
      ) : <Button onClick={() => openAction("create")} className="h-10"><Plus /> Nueva categoría</Button>}

      <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isPending) { setOpen(false); setError(null) } }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
          <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
            <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6"><div className="min-w-0"><Dialog.Title className="text-base font-semibold">{title(action, category)}</Dialog.Title><p className="mt-0.5 truncate text-xs text-muted-foreground">{category?.name ?? "Configuración de colegiatura"}</p></div><Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"><X className="size-4" /></Dialog.Close></header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"><section className="space-y-5"><div><h2 className="text-lg font-semibold">{action === "change" ? "Nueva versión" : action === "rename" ? "Renombrar categoría" : action === "status" ? "Cambiar estado" : "Datos de la categoría"}</h2><p className="mt-1 text-sm text-muted-foreground">{action === "change" ? "El valor anterior conservará su historial." : action === "status" ? "La categoría seguirá visible para preservar su historial." : ""}</p></div>
              {action === "create" && <><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Hermanos" /></Field><Field label="Tipo de descuento"><select value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)} className={selectClass}><option value="FIXED_AMOUNT">Monto fijo</option><option value="PERCENTAGE">Porcentaje</option></select></Field></>}
              {action === "rename" && <><div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Nombre actual</span><span className="mt-1 block font-semibold">{category?.name}</span></div><Field label="Nuevo nombre"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field></>}
              {action === "status" && <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Categoría</span><span className="mt-1 block font-semibold">{category?.name}</span><span className="mt-1 block text-muted-foreground">Estado nuevo: {category?.isActive ? "Inactiva" : "Activa"}</span></div>}
              {(action === "create" || action === "change") && <><>{action === "change" && <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Valor actual/configurado</span><span className="mt-1 block font-semibold">{category?.currentVersion ? formatValue(category.currentVersion.value, category.discountType) : "Sin valor configurado"}</span><span className="mt-1 block text-xs text-muted-foreground">{category?.currentVersion ? `Desde ${formatDate(category.currentVersion.validFrom)}` : ""}</span></div>}</><Field label={action === "change" ? "Nuevo valor" : "Valor"}><div className="relative"><Input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0.00" className={(discountType === "PERCENTAGE" || category?.discountType === "PERCENTAGE") ? "pr-10" : ""} />{(discountType === "PERCENTAGE" || category?.discountType === "PERCENTAGE") && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}</div></Field><Field label="Fecha efectiva"><Input type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field></>}
              <Field label="Motivo"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={action === "status" ? "Explica el motivo del cambio de estado" : "Explica el motivo"} rows={3} /></Field>
            </section></div>
            {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6" role="alert">{error}</p>}
            <footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Guardando..." : action === "status" ? category?.isActive ? "Desactivar" : "Reactivar" : action === "rename" ? "Renombrar" : action === "change" ? "Crear versión" : "Crear categoría"}</Button></footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function title(action: Action, category?: TuitionDiscountCategory) {
  if (action === "rename") return "Renombrar categoría"
  if (action === "status") return category?.isActive ? "Desactivar categoría" : "Reactivar categoría"
  if (action === "change") return "Cambiar valor"
  return "Nueva categoría de descuento"
}

function validate({ action, name, value, effectiveOn, reason, discountType, isEdit }: { action: Action; name: string; value: string; effectiveOn: string; reason: string; discountType: DiscountType; isEdit: boolean }) {
  if (action === "rename" && !name.trim()) return "Indica un nombre nuevo para la categoría."
  if (action !== "status" && action !== "rename") {
    const numericValue = Number(value)
    if (!value.trim() || !Number.isFinite(numericValue) || numericValue <= 0) return "El valor debe ser mayor que cero."
    if (discountType === "PERCENTAGE" && numericValue > 100) return "El porcentaje no puede ser mayor a 100%."
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) return "Captura una fecha efectiva válida."
  }
  if (!reason.trim()) return action === "status" ? "Indica el motivo del cambio de estado." : isEdit ? "Indica el motivo del cambio." : "Indica el motivo de la categoría."
  return null
}

function formatValue(value: number, type: DiscountType) {
  return type === "PERCENTAGE" ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)}%` : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
