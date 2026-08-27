"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import { LoaderCircle, Pencil, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { setSchoolCycleRate } from "@/app/admin/configuracion/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SchoolCycleRate } from "@/lib/admin/school-cycles"

export function SchoolCycleCostSheet({ cycleId, levelId, levelName, conceptCode, rate, defaultDate }: {
  cycleId: string
  levelId: string
  levelName: string
  conceptCode: "TUITION" | "ENROLLMENT_FEE"
  rate: SchoolCycleRate | null
  defaultDate: string
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(rate ? String(rate.amount) : "")
  const [effectiveOn, setEffectiveOn] = useState(rate?.validFrom ?? defaultDate)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()
  const label = conceptCode === "TUITION" ? "Colegiatura" : "Inscripción"

  function openSheet() {
    setAmount(rate ? String(rate.amount) : "")
    setEffectiveOn(rate?.validFrom ?? defaultDate)
    setReason("")
    setError(null)
    setOpen(true)
  }

  function submit() {
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("El monto debe ser cero o mayor.")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) {
      setError("Captura una fecha efectiva válida.")
      return
    }
    if (!reason.trim()) {
      setError("Indica el motivo del cambio.")
      return
    }

    startTransition(async () => {
      const result = await setSchoolCycleRate({ cycleId, educationLevelId: levelId, conceptCode, amount, effectiveOn, reason })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toastManager.add({ title: `${label} actualizada`, description: "Se conservó el historial de tarifas." })
      setOpen(false)
      router.refresh()
    })
  }

  return <>
    <Button variant="ghost" size="sm" onClick={openSheet} aria-label={`Editar ${label.toLowerCase()} de ${levelName}`}><Pencil /> Editar</Button>
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isPending) { setOpen(false); setError(null) } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6"><div><Dialog.Title className="text-base font-semibold">Editar {label.toLowerCase()}</Dialog.Title><p className="mt-0.5 text-xs text-muted-foreground">{levelName}</p></div><Dialog.Close aria-label="Cerrar" disabled={isPending} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></Dialog.Close></header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"><section className="space-y-5"><p className="text-sm text-muted-foreground">El cambio se aplicará desde la fecha indicada y conservará la tarifa anterior.</p><Field label="Monto"><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></Field><Field label="Fecha efectiva"><Input type="date" min={defaultDate} value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></Field><Field label="Motivo"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo del cambio" /></Field></section></div>
          {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
          <footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Guardando..." : "Guardar tarifa"}</Button></footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}
