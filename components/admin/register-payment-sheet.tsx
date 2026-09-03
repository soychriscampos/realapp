"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Select } from "@base-ui/react/select"
import { Toast } from "@base-ui/react/toast"
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  LoaderCircle,
  Mail,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"

import {
  registerPayment,
  sendPaymentReceiptEmail,
  type RegisterPaymentInput,
} from "@/app/admin/alumnos/[id]/payment-actions"
import { Button } from "@/components/ui/button"
import { PaymentReceiptDownloadButton } from "@/components/admin/payment-receipt-download-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  formatCurrency,
  isChargeEligibleForPaymentAllocation,
  type StudentChargeBalance,
} from "@/lib/admin/student-account"
import type {
  PaymentMethodOption,
  PaymentReceiverOption,
} from "@/lib/admin/payments"
import { cn } from "@/lib/utils"

type RegisterPaymentSheetProps = {
  student: {
    id: string
    fullName: string
    context: string
  }
  charges: StudentChargeBalance[]
  methods: PaymentMethodOption[]
  receivers: PaymentReceiverOption[]
  currentReceiverId: string | null
  canReceiveForOthers: boolean
  hasEmailRecipients?: boolean
  disabledReason?: string
  triggerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  onPaymentRegistered?: (paymentId: string) => void
}

type Step = "form" | "review" | "success"
type AllocationValues = Record<string, string>

type PaymentSnapshot = {
  amountCents: number
  appliedCents: number
  creditCents: number
  methodName: string
  receiverName: string
  receivedAt: string
  allocations: Array<{ charge: StudentChargeBalance; cents: number }>
  overrideReason: string | null
}

export function RegisterPaymentSheet({
  student,
  charges,
  methods,
  receivers,
  currentReceiverId,
  canReceiveForOthers,
  hasEmailRecipients = false,
  disabledReason,
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  onPaymentRegistered,
}: RegisterPaymentSheetProps) {
  const router = useRouter()
  const toastManager = Toast.useToastManager()
  const submittingRef = useRef(false)
  const receiptSendingRef = useRef(false)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [amount, setAmount] = useState("")
  const [receivedAt, setReceivedAt] = useState(defaultLocalDateTime)
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "")
  const [receiverId, setReceiverId] = useState(currentReceiverId ?? receivers[0]?.id ?? "")
  const [bankReference, setBankReference] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptVisibleNote, setReceiptVisibleNote] = useState("")
  const [allocations, setAllocations] = useState<AllocationValues>({})
  const [overrideReason, setOverrideReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [isSendingReceipt, setIsSendingReceipt] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pendingCharges = useMemo(
    () =>
      charges
        .filter((charge) => isChargeEligibleForPaymentAllocation(charge))
        .sort(compareCharges),
    [charges]
  )
  const amountCents = userAmountToCents(amount)
  const proposal = useMemo(
    () => buildSuggestedAllocations(pendingCharges, amountCents ?? 0),
    [pendingCharges, amountCents]
  )
  const displayedAllocationCharges = useMemo(
    () => pendingCharges.filter((charge) => {
      const currentCents = userAmountToCents(allocations[charge.id] ?? "") ?? 0
      const proposedCents = userAmountToCents(proposal[charge.id] ?? "") ?? 0
      return currentCents > 0 || currentCents !== proposedCents
    }),
    [allocations, pendingCharges, proposal]
  )
  const proposalChanged = !sameAllocations(allocations, proposal, pendingCharges)
  const selectedMethod = methods.find((method) => method.id === methodId) ?? null
  const selectedReceiver = receivers.find((receiver) => receiver.id === receiverId) ?? null
  const allocationDetails = pendingCharges.map((charge) => ({
    charge,
    cents: userAmountToCents(allocations[charge.id] ?? "") ?? 0,
  }))
  const appliedCents = allocationDetails.reduce((total, item) => total + item.cents, 0)
  const creditCents = Math.max((amountCents ?? 0) - appliedCents, 0)
  const triggerDisabledReason = disabledReason ?? (!methods.length ? "No hay métodos de pago activos disponibles." : undefined)
  const open = controlledOpen ?? uncontrolledOpen

  function handleAmountChange(value: string) {
    setAmount(value)
    const cents = userAmountToCents(value) ?? 0
    setAllocations(buildSuggestedAllocations(pendingCharges, cents))
    setOverrideReason("")
    setError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isPending || isSendingReceipt)) return
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
    if (!nextOpen) resetForm()
  }

  function resetForm() {
    setStep("form")
    setAmount("")
    setReceivedAt(defaultLocalDateTime())
    setMethodId(methods[0]?.id ?? "")
    setReceiverId(currentReceiverId ?? receivers[0]?.id ?? "")
    setBankReference("")
    setNotes("")
    setReceiptVisibleNote("")
    setAllocations({})
    setOverrideReason("")
    setError(null)
    setSnapshot(null)
    setPaymentId(null)
    setIsSendingReceipt(false)
    submittingRef.current = false
    receiptSendingRef.current = false
  }

  function reviewPayment() {
    const validationError = validatePayment()
    if (validationError) {
      setError(validationError)
      return
    }

    setSnapshot({
      amountCents: amountCents ?? 0,
      appliedCents,
      creditCents,
      methodName: selectedMethod?.name ?? "",
      receiverName: selectedReceiver?.fullName ?? "",
      receivedAt,
      allocations: allocationDetails.filter((item) => item.cents > 0),
      overrideReason: proposalChanged ? overrideReason.trim() : null,
    })
    setError(null)
    setStep("review")
  }

  function validatePayment() {
    if (amountCents === null || amountCents <= 0) {
      return "Captura un monto mayor a cero con máximo dos decimales."
    }
    if (!receivedAt || Number.isNaN(new Date(receivedAt).getTime())) {
      return "Captura una fecha y hora de recepción válida."
    }
    if (!selectedMethod) return "Selecciona un método de pago."
    if (!selectedReceiver) return "No hay un receptor autorizado seleccionado."
    if (selectedMethod.requiresDescription && !notes.trim()) {
      return "Agrega una nota interna para este método de pago."
    }

    for (const item of allocationDetails) {
      const rawValue = allocations[item.charge.id] ?? ""
      if (rawValue && userAmountToCents(rawValue) === null) {
        return "Revisa los montos de la distribución."
      }
      if (item.cents < 0) return "La aplicación a un cargo no puede ser negativa."
      if (item.cents > canonicalAmountToCents(item.charge.outstandingAmount)) {
        return `La aplicación a ${chargeLabel(item.charge)} supera su saldo pendiente.`
      }
    }

    if (appliedCents > amountCents) {
      return "El total aplicado no puede superar el total recibido."
    }
    if (proposalChanged && !overrideReason.trim()) {
      return "Explica el motivo del cambio de distribución."
    }

    return null
  }

  function submitPayment() {
    if (!snapshot || submittingRef.current) return
    const validationError = validatePayment()
    if (validationError) {
      setError(validationError)
      setStep("form")
      return
    }

    submittingRef.current = true
    setError(null)

    const input: RegisterPaymentInput = {
      studentId: student.id,
      receivedAt: new Date(receivedAt).toISOString(),
      amount: centsToDecimal(snapshot.amountCents),
      paymentMethodId: methodId,
      receivedByStaffId: receiverId,
      bankReference: bankReference.trim() || null,
      notes: notes.trim() || null,
      receiptVisibleNote: receiptVisibleNote.trim() || null,
      allocations: snapshot.allocations.map((item) => ({
        charge_id: item.charge.id,
        amount: centsToDecimal(item.cents),
      })),
      allocationOverrideReason: snapshot.overrideReason,
    }

    startTransition(async () => {
      const result = await registerPayment(input)
      submittingRef.current = false

      if (!result.ok) {
        setError(result.message)
        if (result.refreshCharges) {
          setStep("form")
          router.refresh()
        }
        return
      }

      setStep("success")
      setPaymentId(result.paymentId)
      onPaymentRegistered?.(result.paymentId)
      toastManager.add({
        title: "Pago registrado",
        description: `${student.fullName} · ${formatCents(snapshot.amountCents)}`,
      })
      router.refresh()
    })
  }

  function sendReceipt() {
    if (!paymentId || receiptSendingRef.current) return

    receiptSendingRef.current = true
    setIsSendingReceipt(true)
    startTransition(async () => {
      const result = await sendPaymentReceiptEmail(student.id, paymentId)
      receiptSendingRef.current = false
      setIsSendingReceipt(false)

      if (result.ok) {
        toastManager.add({ title: "Comprobante enviado por correo." })
        return
      }

      if (result.reason === "NO_RECIPIENTS") {
        toastManager.add({ title: "No hay un correo habilitado para este alumno." })
        return
      }

      toastManager.add({ title: "No fue posible enviar el comprobante." })
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && <div className={cn("flex flex-col items-stretch gap-1.5 sm:items-end", triggerClassName)}>
        <Dialog.Trigger
          disabled={Boolean(triggerDisabledReason)}
          aria-describedby={triggerDisabledReason ? `payment-unavailable-${student.id}` : undefined}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          title={triggerDisabledReason}
        >
          <Banknote className="size-4" />
          Registrar pago
        </Dialog.Trigger>
        {triggerDisabledReason && (
          <p id={`payment-unavailable-${student.id}`} className="max-w-xs text-xs text-muted-foreground sm:text-right">
            {triggerDisabledReason}
          </p>
        )}
      </div>}

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-white outline-none transition duration-200 data-ending-style:translate-x-full data-starting-style:translate-x-full sm:left-auto sm:w-[72vw] sm:border-l sm:border-border sm:shadow-xl md:w-[68vw] lg:w-1/2">
          <SheetHeader
            step={step}
            studentName={student.fullName}
            pending={isPending}
            onBack={() => {
              setError(null)
              setStep("form")
            }}
          />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {step === "form" && (
              <PaymentForm
                student={student}
                amount={amount}
                receivedAt={receivedAt}
                methodId={methodId}
                receiverId={receiverId}
                bankReference={bankReference}
                notes={notes}
                receiptVisibleNote={receiptVisibleNote}
                methods={methods}
                receivers={receivers}
                canReceiveForOthers={canReceiveForOthers}
                selectedMethod={selectedMethod}
                pendingCharges={pendingCharges}
                displayedAllocationCharges={displayedAllocationCharges}
                allocations={allocations}
                proposalChanged={proposalChanged}
                overrideReason={overrideReason}
                amountCents={amountCents ?? 0}
                appliedCents={appliedCents}
                creditCents={creditCents}
                error={error}
                onAmountChange={handleAmountChange}
                onReceivedAtChange={setReceivedAt}
                onMethodChange={(value) => {
                  setMethodId(value)
                  setError(null)
                }}
                onReceiverChange={setReceiverId}
                onBankReferenceChange={setBankReference}
                onNotesChange={setNotes}
                onReceiptVisibleNoteChange={setReceiptVisibleNote}
                onAllocationChange={(chargeId, value) => {
                  setAllocations((current) => ({ ...current, [chargeId]: value }))
                  setError(null)
                }}
                onOverrideReasonChange={setOverrideReason}
              />
            )}

            {step === "review" && snapshot && (
              <PaymentReview studentName={student.fullName} snapshot={snapshot} error={error} />
            )}

            {step === "success" && snapshot && (
              <PaymentSuccess
                student={student}
                paymentId={paymentId}
                snapshot={snapshot}
                hasEmailRecipients={hasEmailRecipients}
                isSendingReceipt={isSendingReceipt}
                onSendReceipt={sendReceipt}
              />
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            {step === "form" && (
              <div className="flex justify-end">
                <Button type="button" size="lg" className="h-10 w-full sm:w-auto" onClick={reviewPayment}>
                  Revisar pago
                </Button>
              </div>
            )}
            {step === "review" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" size="lg" className="h-10" disabled={isPending} onClick={() => setStep("form")}>
                  Editar
                </Button>
                <Button type="button" size="lg" className="h-10" disabled={isPending} onClick={submitPayment}>
                  {isPending ? <LoaderCircle className="animate-spin" /> : <Banknote />}
                  {isPending ? "Registrando..." : "Registrar pago"}
                </Button>
              </div>
            )}
            {step === "success" && (
              <Dialog.Close className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 sm:ml-auto sm:flex sm:w-auto">
                Cerrar
              </Dialog.Close>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SheetHeader({
  step,
  studentName,
  pending,
  onBack,
}: {
  step: Step
  studentName: string
  pending: boolean
  onBack: () => void
}) {
  const title = step === "success" ? "Pago registrado" : step === "review" ? "Confirmar pago" : "Registrar pago"

  return (
    <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      {step === "review" && (
        <button type="button" aria-label="Volver al formulario" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50" disabled={pending} onClick={onBack}>
          <ArrowLeft className="size-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
        <Dialog.Description className="truncate text-xs text-muted-foreground">
          {studentName}
        </Dialog.Description>
      </div>
      <Dialog.Close
        aria-label="Cerrar"
        disabled={pending}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <X className="size-4" />
      </Dialog.Close>
    </div>
  )
}

type PaymentFormProps = {
  student: RegisterPaymentSheetProps["student"]
  amount: string
  receivedAt: string
  methodId: string
  receiverId: string
  bankReference: string
  notes: string
  receiptVisibleNote: string
  methods: PaymentMethodOption[]
  receivers: PaymentReceiverOption[]
  canReceiveForOthers: boolean
  selectedMethod: PaymentMethodOption | null
  pendingCharges: StudentChargeBalance[]
  displayedAllocationCharges: StudentChargeBalance[]
  allocations: AllocationValues
  proposalChanged: boolean
  overrideReason: string
  amountCents: number
  appliedCents: number
  creditCents: number
  error: string | null
  onAmountChange: (value: string) => void
  onReceivedAtChange: (value: string) => void
  onMethodChange: (value: string) => void
  onReceiverChange: (value: string) => void
  onBankReferenceChange: (value: string) => void
  onNotesChange: (value: string) => void
  onReceiptVisibleNoteChange: (value: string) => void
  onAllocationChange: (chargeId: string, value: string) => void
  onOverrideReasonChange: (value: string) => void
}

function PaymentForm(props: PaymentFormProps) {
  return (
    <div className="space-y-7 px-4 py-5 sm:px-6 sm:py-6">
      <section className="space-y-4" aria-labelledby="payment-data">
        <div>
          <h3 id="payment-data" className="text-sm font-semibold">Datos del pago</h3>
          <p className="mt-1 text-sm text-muted-foreground">{props.student.context}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto recibido" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input inputMode="decimal" value={props.amount} onChange={(event) => props.onAmountChange(event.target.value)} placeholder="0.00" className="h-10 pl-7 text-base tabular-nums" aria-label="Monto recibido" />
            </div>
          </Field>
          <Field label="Fecha y hora de recepción" required>
            <Input type="datetime-local" value={props.receivedAt} onChange={(event) => props.onReceivedAtChange(event.target.value)} className="h-10" />
          </Field>
          <Field label="Método de pago" required>
            <PaymentSelect value={props.methodId} options={props.methods.map((method) => ({ value: method.id, label: method.name }))} placeholder="Seleccionar método" onChange={props.onMethodChange} />
          </Field>
          <Field label="Recibido por" required>
            {props.canReceiveForOthers ? (
              <PaymentSelect value={props.receiverId} options={props.receivers.map((receiver) => ({ value: receiver.id, label: receiver.fullName }))} placeholder="Seleccionar receptor" onChange={props.onReceiverChange} />
            ) : (
              <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm">
                {props.receivers.find((receiver) => receiver.id === props.receiverId)?.fullName ?? "Sin receptor disponible"}
              </div>
            )}
          </Field>
          {["TRANSFER", "DEPOSIT"].includes(props.selectedMethod?.code ?? "") && (
            <Field label="Referencia bancaria">
              <Input value={props.bankReference} onChange={(event) => props.onBankReferenceChange(event.target.value)} className="h-10" placeholder="Opcional" />
            </Field>
          )}
        </div>
        <Field label={`Notas internas${props.selectedMethod?.requiresDescription ? " *" : ""}`}>
          <Textarea value={props.notes} onChange={(event) => props.onNotesChange(event.target.value)} placeholder={props.selectedMethod?.requiresDescription ? "Describe este método de pago" : "Opcional"} />
        </Field>
        <Field label="Nota visible en recibo">
          <Textarea value={props.receiptVisibleNote} onChange={(event) => props.onReceiptVisibleNoteChange(event.target.value)} placeholder="Opcional" />
        </Field>
      </section>

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="payment-allocation">
        <div>
          <h3 id="payment-allocation" className="text-sm font-semibold">Distribución</h3>
          <p className="mt-1 text-sm text-muted-foreground">Propuesta basada en los saldos pendientes más antiguos.</p>
        </div>
        {props.displayedAllocationCharges.length ? (
          <div className="divide-y divide-border border-y border-border">
            {props.displayedAllocationCharges.map((charge) => (
              <div key={charge.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{chargeLabel(charge)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{charge.cycleCode} · Pendiente {formatCurrency(charge.outstandingAmount)}</p>
                </div>
                <div>
                  <Label htmlFor={`allocation-${charge.id}`} className="mb-2 sm:sr-only">Aplicar a {chargeLabel(charge)}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input id={`allocation-${charge.id}`} inputMode="decimal" value={props.allocations[charge.id] ?? ""} onChange={(event) => props.onAllocationChange(charge.id, event.target.value)} className="h-10 pl-7 text-right tabular-nums" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : props.pendingCharges.length ? (
          <p className="border-y border-border py-4 text-sm text-muted-foreground">Captura un monto para mostrar la distribución propuesta.</p>
        ) : (
          <p className="border-y border-border py-4 text-sm text-muted-foreground">No hay cargos pendientes. El pago completo se registrará como saldo a favor.</p>
        )}

        {props.proposalChanged && (
          <Field label="Motivo del cambio de distribución" required>
            <Textarea value={props.overrideReason} onChange={(event) => props.onOverrideReasonChange(event.target.value)} placeholder="Explica por qué se cambió la propuesta" />
          </Field>
        )}

        <Totals amountCents={props.amountCents} appliedCents={props.appliedCents} creditCents={props.creditCents} />
      </section>

      {props.error && <ErrorMessage message={props.error} />}
    </div>
  )
}

function PaymentReview({ studentName, snapshot, error }: { studentName: string; snapshot: PaymentSnapshot; error: string | null }) {
  return (
    <div className="space-y-7 px-4 py-5 sm:px-6 sm:py-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Revisa antes de registrar</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReviewItem label="Alumno" value={studentName} />
          <ReviewItem label="Monto" value={formatCents(snapshot.amountCents)} emphasis />
          <ReviewItem label="Método" value={snapshot.methodName} />
          <ReviewItem label="Recibido por" value={snapshot.receiverName} />
          <ReviewItem label="Fecha" value={formatDateTime(snapshot.receivedAt)} />
        </dl>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Aplicación del pago</h3>
        {snapshot.allocations.length ? (
          <div className="divide-y divide-border border-y border-border">
            {snapshot.allocations.map((item) => (
              <div key={item.charge.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{chargeLabel(item.charge)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.charge.cycleCode}</p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">{formatCents(item.cents)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se aplicará a cargos pendientes.</p>
        )}
        {snapshot.overrideReason && (
          <div className="border-l-2 border-border pl-3 text-sm">
            <p className="font-medium">Motivo del cambio de distribución</p>
            <p className="mt-1 text-muted-foreground">{snapshot.overrideReason}</p>
          </div>
        )}
        <Totals amountCents={snapshot.amountCents} appliedCents={snapshot.appliedCents} creditCents={snapshot.creditCents} />
      </section>
      {error && <ErrorMessage message={error} />}
    </div>
  )
}

function PaymentSuccess({
  student,
  paymentId,
  snapshot,
  hasEmailRecipients,
  isSendingReceipt,
  onSendReceipt,
}: {
  student: RegisterPaymentSheetProps["student"]
  paymentId: string | null
  snapshot: PaymentSnapshot
  hasEmailRecipients: boolean
  isSendingReceipt: boolean
  onSendReceipt: () => void
}) {
  return (
    <div className="space-y-7 px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700" />
        <div>
          <h3 className="text-lg font-semibold">El pago quedó registrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">{student.fullName}</p>
        </div>
      </div>
      <dl className="grid gap-4 border-y border-border py-5 sm:grid-cols-2">
        <ReviewItem label="Monto" value={formatCents(snapshot.amountCents)} emphasis />
        <ReviewItem label="Método" value={snapshot.methodName} />
        <ReviewItem label="Recibido por" value={snapshot.receiverName} />
        <ReviewItem label="Aplicado a cargos" value={formatCents(snapshot.appliedCents)} />
        {snapshot.creditCents > 0 && <ReviewItem label="Saldo a favor generado" value={formatCents(snapshot.creditCents)} emphasis />}
      </dl>
      <p className="text-sm text-muted-foreground">El estado de cuenta se actualizó con la operación confirmada.</p>
      {paymentId && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <PaymentReceiptDownloadButton
            href={`/admin/alumnos/${student.id}/pagos/${paymentId}/recibo`}
            className="h-10 w-full sm:w-auto"
          >
            <Download />
            Descargar recibo
          </PaymentReceiptDownloadButton>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:w-auto"
            disabled={!hasEmailRecipients || isSendingReceipt}
            onClick={onSendReceipt}
            title={!hasEmailRecipients ? "No hay un correo habilitado para este alumno." : undefined}
          >
            {isSendingReceipt ? <LoaderCircle className="animate-spin" /> : <Mail />}
            {isSendingReceipt ? "Enviando..." : "Enviar por correo"}
          </Button>
        </div>
      )}
    </div>
  )
}

function PaymentSelect({ value, options, placeholder, onChange }: { value: string; options: Array<{ value: string; label: string }>; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select.Root value={value || null} items={options} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
      <Select.Trigger className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 text-sm outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        <Select.Value placeholder={placeholder} className="truncate data-placeholder:text-muted-foreground" />
        <Select.Icon><ChevronDown className="size-4 text-muted-foreground" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-[70] outline-none" sideOffset={4}>
          <Select.Popup className="w-max min-w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-white py-1 shadow-lg outline-none">
            <Select.List className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="grid cursor-default grid-cols-[1rem_auto] items-center gap-2 px-3 py-2 text-sm outline-none data-highlighted:bg-muted">
                  <Select.ItemIndicator><Check className="size-4" /></Select.ItemIndicator>
                  <Select.ItemText className="whitespace-nowrap">{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span aria-hidden="true"> *</span>}</Label>
      {children}
    </div>
  )
}

function Totals({ amountCents, appliedCents, creditCents }: { amountCents: number; appliedCents: number; creditCents: number }) {
  return (
    <dl className="space-y-2 border-t border-border pt-4 text-sm">
      <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Total recibido</dt><dd className="font-semibold tabular-nums">{formatCents(amountCents)}</dd></div>
      <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Total aplicado</dt><dd className="font-medium tabular-nums">{formatCents(appliedCents)}</dd></div>
      <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Saldo a favor resultante</dt><dd className={cn("font-medium tabular-nums", creditCents > 0 && "text-emerald-700")}>{formatCents(creditCents)}</dd></div>
    </dl>
  )
}

function ReviewItem({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("mt-1 text-sm font-medium", emphasis && "text-base tabular-nums")}>{value}</dd></div>
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}

function buildSuggestedAllocations(charges: StudentChargeBalance[], paymentCents: number): AllocationValues {
  let remaining = Math.max(paymentCents, 0)
  const next: AllocationValues = {}
  for (const charge of charges) {
    const outstanding = canonicalAmountToCents(charge.outstandingAmount)
    const allocation = Math.min(remaining, outstanding)
    next[charge.id] = allocation > 0 ? centsToInput(allocation) : ""
    remaining -= allocation
  }
  return next
}

function sameAllocations(current: AllocationValues, proposal: AllocationValues, charges: StudentChargeBalance[]) {
  return charges.every((charge) => (userAmountToCents(current[charge.id] ?? "") ?? 0) === (userAmountToCents(proposal[charge.id] ?? "") ?? 0))
}

function compareCharges(left: StudentChargeBalance, right: StudentChargeBalance) {
  return left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id)
}

function canonicalAmountToCents(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return 0
  const whole = Number(match[1])
  const fraction = `${match[2] ?? ""}00`.slice(0, 2)
  const cents = whole * 100 + Number(fraction)
  return Number.isSafeInteger(cents) ? cents : 0
}

function userAmountToCents(value: string) {
  const normalized = value.trim()
  if (!normalized) return 0
  const match = normalized.match(/^(\d+)(?:\.(\d{0,2}))?$/)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number(`${match[2] ?? ""}00`.slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : null
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

function chargeLabel(charge: StudentChargeBalance) {
  if (charge.coverageMonth && charge.coverageYear) {
    const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(new Date(charge.coverageYear, charge.coverageMonth - 1, 1))
    return `${month.replace(".", "")} ${charge.coverageYear} · ${charge.conceptName}`
  }
  return charge.conceptName
}

function defaultLocalDateTime() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}
