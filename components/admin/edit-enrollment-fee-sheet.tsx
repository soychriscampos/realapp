"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Pencil, X } from "lucide-react"
import { useState, useTransition } from "react"

import { adjustEnrollmentFee } from "@/app/admin/matricula/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/admin/tuition-discount-preview"

export function EditEnrollmentFeeSheet({ enrollmentId, chargeId, amount, dueDate }: { enrollmentId: string; chargeId: string | null; amount: number | null; dueDate: string }) {
  const [open, setOpen] = useState(false)
  const [targetAmount, setTargetAmount] = useState(amount?.toFixed(2) ?? "")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const result = await adjustEnrollmentFee({ enrollmentId, chargeId, targetAmount, dueDate, reason })
      if (!result.ok) { setError(result.message); return }
      setOpen(false)
      window.location.reload()
    })
  }

  return <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) { setTargetAmount(amount?.toFixed(2) ?? ""); setReason(""); setError(null) } }}><Dialog.Trigger render={<Button variant="outline" size="sm"><Pencil /> {amount === null ? "Agregar cargo" : "Corregir monto"}</Button>} /><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" /><Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2"><header className="flex min-h-14 items-center justify-between border-b border-border px-4 sm:px-6"><div><Dialog.Title className="text-base font-semibold">{amount === null ? "Agregar inscripción" : "Corregir inscripción"}</Dialog.Title><p className="mt-0.5 text-xs text-muted-foreground">{amount === null ? "No hay un cargo registrado." : `Monto actual: ${formatCurrency(amount)}`}</p></div><Dialog.Close aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></Dialog.Close></header><div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"><label className="grid gap-2 text-sm font-medium"><span>{amount === null ? "Monto de inscripción" : "Nuevo monto"}</span><Input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium"><span>Motivo</span><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica la corrección" rows={3} /></label></div>{error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}<footer className="flex justify-end gap-3 border-t border-border px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close render={<Button variant="ghost" disabled={pending}>Cancelar</Button>} /><Button disabled={pending} onClick={submit}>{pending ? "Guardando..." : amount === null ? "Agregar cargo" : "Guardar corrección"}</Button></footer></Dialog.Popup></Dialog.Portal></Dialog.Root>
}
