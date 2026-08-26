"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Toast } from "@base-ui/react/toast"
import {
  ArrowLeft,
  CircleAlert,
  FilePenLine,
  LoaderCircle,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useMemo, useRef, useState, useTransition } from "react"

import {
  correctPaymentAllocations,
  reversePayment,
  updatePaymentMetadata,
} from "@/app/admin/alumnos/[id]/payment-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  formatCurrency,
  type StudentChargeBalance,
  type StudentPaymentDetail,
} from "@/lib/admin/student-account"
import { cn } from "@/lib/utils"

type PaymentDetailsSheetProps = {
  studentId: string
  payment: StudentPaymentDetail
  charges: StudentChargeBalance[]
  canManage: boolean
  triggerClassName?: string
  triggerLabel?: ReactNode
}

type View = "detail" | "metadata" | "allocations" | "reverse"
type AllocationValues = Record<string, string>

export function PaymentDetailsSheet({
  studentId,
  payment,
  charges,
  canManage,
  triggerClassName,
  triggerLabel = "Ver detalle",
}: PaymentDetailsSheetProps) {
  const toastManager = Toast.useToastManager()
  const router = useRouter()
  const submittingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("detail")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const confirmed = payment.status === "CONFIRMED"
  const chargeById = useMemo(
    () => new Map(charges.map((charge) => [charge.id, charge])),
    [charges]
  )
  const correctionAvailable = payment.allocations.length > 0 && payment.allocations.every(
    (allocation) => chargeById.has(allocation.chargeId)
  )

  function closeSheet() {
    if (isPending) return
    setOpen(false)
    setView("detail")
    setError(null)
    submittingRef.current = false
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          return
        }
        closeSheet()
      }}
    >
      <Dialog.Trigger
        className={cn(
          "inline-flex min-h-9 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          triggerClassName
        )}
      >
        {triggerLabel}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none transition duration-200 data-ending-style:translate-x-full data-starting-style:translate-x-full sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <PaymentSheetHeader
            view={view}
            pending={isPending}
            onBack={() => {
              setError(null)
              setView("detail")
            }}
            onClose={closeSheet}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {view === "detail" && (
              <PaymentDetail
                payment={payment}
                charges={chargeById}
                canManage={canManage}
                confirmed={confirmed}
                correctionAvailable={correctionAvailable}
                onEditMetadata={() => setView("metadata")}
                onCorrectAllocations={() => setView("allocations")}
                onReverse={() => setView("reverse")}
              />
            )}
            {view === "metadata" && (
              <MetadataEditor
                studentId={studentId}
                payment={payment}
                pending={isPending}
                error={error}
                onSuccess={() => {
                  toastManager.add({ title: "Pago actualizado", description: "Los datos no financieros se guardaron." })
                  router.refresh()
                  setError(null)
                  setView("detail")
                }}
                onError={setError}
                onRefresh={() => router.refresh()}
                startTransition={startTransition}
                submittingRef={submittingRef}
              />
            )}
            {view === "allocations" && (
              <AllocationEditor
                studentId={studentId}
                payment={payment}
                charges={charges}
                pending={isPending}
                error={error}
                onSuccess={() => {
                  toastManager.add({ title: "Distribución corregida", description: "El estado de cuenta se actualizó." })
                  router.refresh()
                  setError(null)
                  setView("detail")
                }}
                onError={setError}
                onRefresh={() => router.refresh()}
                startTransition={startTransition}
                submittingRef={submittingRef}
              />
            )}
            {view === "reverse" && (
              <ReversePaymentForm
                studentId={studentId}
                payment={payment}
                pending={isPending}
                error={error}
                onSuccess={() => {
                  toastManager.add({ title: "Pago revertido", description: "El estado de cuenta se recalculó." })
                  router.refresh()
                  closeSheet()
                }}
                onError={setError}
                onRefresh={() => router.refresh()}
                startTransition={startTransition}
                submittingRef={submittingRef}
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PaymentSheetHeader({
  view,
  pending,
  onBack,
  onClose,
}: {
  view: View
  pending: boolean
  onBack: () => void
  onClose: () => void
}) {
  const title = {
    detail: "Detalle de pago",
    metadata: "Corregir datos",
    allocations: "Corregir distribución",
    reverse: "Revertir pago",
  }[view]

  return (
    <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      {view !== "detail" && (
        <button
          type="button"
          aria-label="Volver al detalle"
          disabled={pending}
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <ArrowLeft className="size-4" />
        </button>
      )}
      <Dialog.Title className="min-w-0 flex-1 text-base font-semibold">{title}</Dialog.Title>
      <button
        type="button"
        aria-label="Cerrar"
        disabled={pending}
        onClick={onClose}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function PaymentDetail({
  payment,
  charges,
  canManage,
  confirmed,
  correctionAvailable,
  onEditMetadata,
  onCorrectAllocations,
  onReverse,
}: {
  payment: StudentPaymentDetail
  charges: Map<string, StudentChargeBalance>
  canManage: boolean
  confirmed: boolean
  correctionAvailable: boolean
  onEditMetadata: () => void
  onCorrectAllocations: () => void
  onReverse: () => void
}) {
  return (
    <div className="space-y-7 px-4 py-5 sm:px-6 sm:py-6">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(payment.amount)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(payment.receivedAt)}</p>
          </div>
          <PaymentStatus status={payment.status} />
        </div>
        <dl className="grid gap-4 border-y border-border py-5 sm:grid-cols-2">
          <DetailItem label="Método" value={payment.methodName || "Pago recibido"} />
          <DetailItem label="Recibido por" value={payment.receivedByName || "Sin dato disponible"} />
          {payment.bankReference && <DetailItem label="Referencia bancaria" value={payment.bankReference} />}
          {payment.notes && <DetailItem label="Notas internas" value={payment.notes} />}
          {payment.receiptVisibleNote && <DetailItem label="Nota visible en recibo" value={payment.receiptVisibleNote} />}
        </dl>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <h3 className="text-sm font-semibold">Aplicación del pago</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cargos cubiertos por este pago.</p>
        </div>
        {payment.allocations.length ? (
          <div className="divide-y divide-border border-y border-border">
            {payment.allocations.map((allocation) => (
              <AllocationSummary
                key={allocation.chargeId}
                charge={charges.get(allocation.chargeId)}
                amount={allocation.amount}
              />
            ))}
          </div>
        ) : (
          <p className="border-y border-border py-4 text-sm text-muted-foreground">
            Este pago no tiene aplicaciones vigentes a cargos.
          </p>
        )}
      </section>

      {canManage && confirmed && (
        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-sm font-semibold">Gestionar pago</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-10 justify-start" onClick={onEditMetadata}>
              <FilePenLine />
              Corregir datos
            </Button>
            {correctionAvailable && (
              <Button type="button" variant="outline" className="h-10 justify-start" onClick={onCorrectAllocations}>
                <SlidersHorizontal />
                Corregir distribución
              </Button>
            )}
            <Button type="button" variant="destructive" className="h-10 justify-start sm:col-span-2" onClick={onReverse}>
              <RotateCcw />
              Revertir pago
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}

function MetadataEditor({
  studentId,
  payment,
  pending,
  error,
  onSuccess,
  onError,
  onRefresh,
  startTransition,
  submittingRef,
}: {
  studentId: string
  payment: StudentPaymentDetail
  pending: boolean
  error: string | null
  onSuccess: () => void
  onError: (message: string | null) => void
  onRefresh: () => void
  startTransition: (callback: () => void) => void
  submittingRef: React.MutableRefObject<boolean>
}) {
  const [bankReference, setBankReference] = useState(payment.bankReference ?? "")
  const [notes, setNotes] = useState(payment.notes ?? "")
  const [receiptVisibleNote, setReceiptVisibleNote] = useState(payment.receiptVisibleNote ?? "")
  const [reason, setReason] = useState("")

  function submit() {
    if (submittingRef.current) return
    const patch = changedMetadata(payment, { bankReference, notes, receiptVisibleNote })
    if (!Object.keys(patch).length) {
      onError("Modifica al menos un dato antes de guardar.")
      return
    }
    if (!reason.trim()) {
      onError("Indica el motivo de la corrección.")
      return
    }

    submittingRef.current = true
    onError(null)
    startTransition(async () => {
      const result = await updatePaymentMetadata({
        studentId,
        paymentId: payment.id,
        patch,
        reason,
      })
      submittingRef.current = false
      if (!result.ok) {
        if (result.refreshAccount) onRefresh()
        onError(result.message)
        return
      }
      onSuccess()
    })
  }

  return (
    <FormLayout
      title="Solo se pueden corregir datos no financieros."
      error={error}
      footer={
        <Button type="button" size="lg" className="h-10 w-full sm:w-auto" disabled={pending} onClick={submit}>
          {pending && <LoaderCircle className="animate-spin" />}
          Guardar corrección
        </Button>
      }
    >
      <Field label="Referencia bancaria"><Input value={bankReference} onChange={(event) => setBankReference(event.target.value)} className="h-10" /></Field>
      <Field label="Notas internas"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      <Field label="Nota visible en recibo"><Textarea value={receiptVisibleNote} onChange={(event) => setReceiptVisibleNote(event.target.value)} /></Field>
      <Field label="Motivo de la corrección" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </FormLayout>
  )
}

function AllocationEditor({
  studentId,
  payment,
  charges,
  pending,
  error,
  onSuccess,
  onError,
  onRefresh,
  startTransition,
  submittingRef,
}: {
  studentId: string
  payment: StudentPaymentDetail
  charges: StudentChargeBalance[]
  pending: boolean
  error: string | null
  onSuccess: () => void
  onError: (message: string | null) => void
  onRefresh: () => void
  startTransition: (callback: () => void) => void
  submittingRef: React.MutableRefObject<boolean>
}) {
  const initialValues = useMemo(() => allocationValues(payment.allocations), [payment.allocations])
  const [allocations, setAllocations] = useState<AllocationValues>(initialValues)
  const [reason, setReason] = useState("")
  const currentByCharge = useMemo(() => allocationCentsByCharge(payment.allocations), [payment.allocations])
  const existingTotal = useMemo(
    () => payment.allocations.reduce((total, allocation) => total + toCents(allocation.amount), 0),
    [payment.allocations]
  )
  const total = charges.reduce((sum, charge) => sum + (inputToCents(allocations[charge.id] ?? "") ?? 0), 0)

  function submit() {
    if (submittingRef.current) return
    if (!reason.trim()) {
      onError("Indica el motivo de la corrección.")
      return
    }
    if (total !== existingTotal) {
      onError("La distribución debe conservar exactamente el total aplicado actual.")
      return
    }

    const nextAllocations = charges.flatMap((charge) => {
      const cents = inputToCents(allocations[charge.id] ?? "")
      const capacity = toCents(charge.outstandingAmount) + (currentByCharge.get(charge.id) ?? 0)
      if (cents === null || cents < 0 || cents > capacity) return []
      return cents > 0 ? [{ charge_id: charge.id, amount: centsToDecimal(cents) }] : []
    })

    if (!nextAllocations.length) {
      onError("Define al menos una aplicación válida.")
      return
    }

    submittingRef.current = true
    onError(null)
    startTransition(async () => {
      const result = await correctPaymentAllocations({
        studentId,
        paymentId: payment.id,
        allocations: nextAllocations,
        reason,
      })
      submittingRef.current = false
      if (!result.ok) {
        if (result.refreshAccount) onRefresh()
        onError(result.message)
        return
      }
      onSuccess()
    })
  }

  return (
    <FormLayout
      title={`El total aplicado debe permanecer en ${formatCents(existingTotal)}.`}
      error={error}
      footer={
        <Button type="button" size="lg" className="h-10 w-full sm:w-auto" disabled={pending} onClick={submit}>
          {pending && <LoaderCircle className="animate-spin" />}
          Guardar distribución
        </Button>
      }
    >
      <div className="divide-y divide-border border-y border-border">
        {charges.map((charge) => {
          const current = currentByCharge.get(charge.id) ?? 0
          const capacity = toCents(charge.outstandingAmount) + current

          return (
            <div key={charge.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium">{chargeLabel(charge)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Disponible para este ajuste: {formatCents(capacity)}</p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  inputMode="decimal"
                  value={allocations[charge.id] ?? ""}
                  onChange={(event) => setAllocations((currentValues) => ({ ...currentValues, [charge.id]: event.target.value }))}
                  className="h-10 pl-7 text-right tabular-nums"
                  aria-label={`Aplicar a ${chargeLabel(charge)}`}
                />
              </div>
            </div>
          )
        })}
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Aplicado actualmente</dt><dd className="font-medium tabular-nums">{formatCents(existingTotal)}</dd></div>
        <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Nueva distribución</dt><dd className={cn("font-medium tabular-nums", total !== existingTotal && "text-destructive")}>{formatCents(total)}</dd></div>
      </dl>
      <Field label="Motivo de la corrección" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </FormLayout>
  )
}

function ReversePaymentForm({
  studentId,
  payment,
  pending,
  error,
  onSuccess,
  onError,
  onRefresh,
  startTransition,
  submittingRef,
}: {
  studentId: string
  payment: StudentPaymentDetail
  pending: boolean
  error: string | null
  onSuccess: () => void
  onError: (message: string | null) => void
  onRefresh: () => void
  startTransition: (callback: () => void) => void
  submittingRef: React.MutableRefObject<boolean>
}) {
  const [reason, setReason] = useState("")

  function submit() {
    if (submittingRef.current) return
    if (!reason.trim()) {
      onError("Indica el motivo de la reversión.")
      return
    }

    submittingRef.current = true
    onError(null)
    startTransition(async () => {
      const result = await reversePayment({ studentId, paymentId: payment.id, reason })
      submittingRef.current = false
      if (!result.ok) {
        if (result.refreshAccount) onRefresh()
        onError(result.message)
        return
      }
      onSuccess()
    })
  }

  return (
    <FormLayout
      title={`Se revertirá el pago de ${formatCurrency(payment.amount)}. Dejará de considerarse vigente y el estado de cuenta se recalculará.`}
      error={error}
      destructive
      footer={
        <Button type="button" variant="destructive" size="lg" className="h-10 w-full sm:w-auto" disabled={pending} onClick={submit}>
          {pending && <LoaderCircle className="animate-spin" />}
          Revertir pago
        </Button>
      }
    >
      <Field label="Motivo de la reversión" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </FormLayout>
  )
}

function FormLayout({
  title,
  error,
  destructive = false,
  children,
  footer,
}: {
  title: string
  error: string | null
  destructive?: boolean
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <p className={cn("text-sm text-muted-foreground", destructive && "text-destructive")}>{title}</p>
        {children}
        {error && <ErrorMessage message={error} />}
      </div>
      <div className="border-t border-border px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        <div className="flex justify-end">{footer}</div>
      </div>
    </div>
  )
}

function AllocationSummary({ charge, amount }: { charge: StudentChargeBalance | undefined; amount: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{charge ? chargeLabel(charge) : "Cargo no disponible"}</p>
        {charge && <p className="mt-1 text-xs text-muted-foreground">{charge.cycleCode}</p>}
      </div>
      <p className="shrink-0 font-medium tabular-nums">{formatCurrency(amount)}</p>
    </div>
  )
}

function PaymentStatus({ status }: { status: string }) {
  const reversed = status === "REVERSED"
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", reversed ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700")}>{reversed ? "Revertido" : "Confirmado"}</span>
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{value}</dd></div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}{required && <span aria-hidden="true"> *</span>}</Label>{children}</div>
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>{message}</p></div>
}

function changedMetadata(payment: StudentPaymentDetail, values: { bankReference: string; notes: string; receiptVisibleNote: string }) {
  const patch: Record<string, string | null> = {}
  const nextValues = {
    bank_reference: normalizeText(values.bankReference),
    notes: normalizeText(values.notes),
    receipt_visible_note: normalizeText(values.receiptVisibleNote),
  }
  const previousValues = {
    bank_reference: payment.bankReference,
    notes: payment.notes,
    receipt_visible_note: payment.receiptVisibleNote,
  }

  for (const [key, value] of Object.entries(nextValues)) {
    if (value !== previousValues[key as keyof typeof previousValues]) patch[key] = value
  }

  return patch
}

function allocationValues(allocations: StudentPaymentDetail["allocations"]) {
  return Object.fromEntries(allocations.map((allocation) => [allocation.chargeId, centsToInput(toCents(allocation.amount))]))
}

function allocationCentsByCharge(allocations: StudentPaymentDetail["allocations"]) {
  return new Map(allocations.map((allocation) => [allocation.chargeId, toCents(allocation.amount)]))
}

function inputToCents(value: string) {
  const normalized = value.trim()
  if (!normalized) return 0
  const match = normalized.match(/^(\d+)(?:\.(\d{0,2}))?$/)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number(`${match[2] ?? ""}00`.slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : null
}

function toCents(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return 0
  const cents = Number(match[1]) * 100 + Number(`${match[2] ?? ""}00`.slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : 0
}

function centsToDecimal(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`
}

function centsToInput(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : centsToDecimal(cents)
}

function formatCents(cents: number) {
  return formatCurrency(centsToDecimal(cents))
}

function normalizeText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function chargeLabel(charge: StudentChargeBalance) {
  if (charge.coverageMonth && charge.coverageYear) {
    const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(new Date(charge.coverageYear, charge.coverageMonth - 1, 1))
    return `${month.replace(".", "")} ${charge.coverageYear} · ${charge.conceptName}`
  }
  return charge.conceptName
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}
