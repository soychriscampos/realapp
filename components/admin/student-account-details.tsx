"use client"

import { Tabs } from "@base-ui/react/tabs"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { PaymentDetailsSheet } from "@/components/admin/payment-details-sheet"
import {
  formatCurrency,
  type StudentAccountMovement,
  type StudentChargeBalance,
  type StudentPaymentDetail,
  isChargeVisibleInCycle,
} from "@/lib/admin/student-account"

type StudentAccountDetailsProps = {
  charges: StudentChargeBalance[]
  movements: StudentAccountMovement[]
  payments: StudentPaymentDetail[]
  studentId: string
  currentReceiverId: string | null
  isMaster: boolean
  paymentDetailsError?: boolean
  operationalCycleId?: string
}

type CycleGroup = {
  id: string
  label: string
  charges: StudentChargeBalance[]
  sortValue: number
}

export function StudentAccountDetails({
  charges,
  movements,
  payments: paymentDetailsData,
  studentId,
  currentReceiverId,
  isMaster,
  paymentDetailsError = false,
  operationalCycleId,
}: StudentAccountDetailsProps) {
  const cycles = useMemo(() => groupChargesByCycle(charges.filter((charge) => isChargeVisibleInCycle(charge))), [charges])
  const defaultCycleId = cycles.find((cycle) => cycle.id === operationalCycleId)?.id ?? cycles[0]?.id

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="tuition-breakdown">
        <div>
          <h2 id="tuition-breakdown" className="text-base font-semibold">Colegiaturas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta lo aplicado y pendiente en cada periodo.
          </p>
        </div>

        {cycles.length ? (
          <Tabs.Root defaultValue={defaultCycleId}>
            <Tabs.List
              aria-label="Ciclo escolar"
              className="flex w-full gap-1 overflow-x-auto border-b border-border pb-px"
            >
              {cycles.map((cycle) => (
                <Tabs.Tab
                  key={cycle.id}
                  value={cycle.id}
                  className="shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active]:border-foreground data-[active]:text-foreground"
                >
                  {cycle.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {cycles.map((cycle) => (
              <Tabs.Panel key={cycle.id} value={cycle.id} className="pt-4 outline-none">
                <CycleBreakdown charges={cycle.charges} />
                <PriorCycleBalance
                  cycles={cycles}
                  selectedCycleId={cycle.id}
                  operationalCycleId={operationalCycleId}
                />
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        ) : (
          <p className="border-y border-border py-5 text-sm text-muted-foreground">
            No hay cargos financieros registrados para este alumno.
          </p>
        )}
      </section>

      <PaymentHistory
        movements={movements}
        payments={paymentDetailsData}
        charges={charges}
        studentId={studentId}
        currentReceiverId={currentReceiverId}
        isMaster={isMaster}
        detailsError={paymentDetailsError}
      />
    </div>
  )
}

function CycleBreakdown({ charges }: { charges: StudentChargeBalance[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-white md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-[32%] px-4 py-3 font-medium">Periodo</th>
              <th className="w-[17%] px-3 py-3 text-right font-medium">Importe</th>
              <th className="w-[17%] px-3 py-3 text-right font-medium">Aplicado</th>
              <th className="w-[17%] px-3 py-3 text-right font-medium">Saldo</th>
              <th className="w-[17%] px-4 py-3 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {charges.map((charge) => (
              <tr key={charge.id}>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium">{periodLabel(charge, "short")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{charge.conceptName}</p>
                </td>
                <AmountCell value={charge.effectiveAmount} />
                <AmountCell value={charge.totalApplied} negative />
                <AmountCell value={charge.outstandingAmount} emphasis={charge.isOverdue} />
                <td className="px-4 py-3 text-right align-top">
                  <ChargeStatus charge={charge} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border border-y border-border md:hidden">
        {charges.map((charge) => (
          <article key={charge.id} className="py-4 first:pt-3 last:pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{periodLabel(charge, "long")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{charge.conceptName}</p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums">
                {formatCurrency(charge.effectiveAmount)}
              </p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <MobileMetric label="Aplicado" value={`-${formatCurrency(charge.totalApplied)}`} />
              <MobileMetric
                label="Saldo"
                value={formatCurrency(charge.outstandingAmount)}
                valueClassName={charge.isOverdue ? "text-destructive" : undefined}
              />
              <MobileMetric
                label="Estado"
                value={chargeStatusLabel(charge)}
                valueClassName={charge.isPaid ? "text-emerald-700" : charge.isOverdue ? "text-destructive" : undefined}
              />
            </dl>
          </article>
        ))}
      </div>
    </>
  )
}

function PriorCycleBalance({
  cycles,
  selectedCycleId,
  operationalCycleId,
}: {
  cycles: CycleGroup[]
  selectedCycleId: string
  operationalCycleId?: string
}) {
  if (!operationalCycleId || selectedCycleId !== operationalCycleId) return null

  const previousBalances = cycles
    .filter((cycle) => cycle.id !== operationalCycleId)
    .map((cycle) => ({ label: cycle.label, amount: sumAmounts(cycle.charges.map((charge) => charge.outstandingAmount)) }))
    .filter((cycle) => amountNumber(cycle.amount) > 0)

  if (!previousBalances.length) return null

  return (
    <div className="mt-5 border-l-2 border-border pl-4">
      <p className="text-sm font-medium">Incluye saldo de ciclos anteriores</p>
      <dl className="mt-3 space-y-2 text-sm">
        {previousBalances.map((cycle) => (
          <div key={cycle.label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{cycle.label}</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(cycle.amount)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PaymentHistory({
  movements,
  payments: paymentDetailsData,
  charges,
  studentId,
  currentReceiverId,
  isMaster,
  detailsError,
}: {
  movements: StudentAccountMovement[]
  payments: StudentPaymentDetail[]
  charges: StudentChargeBalance[]
  studentId: string
  currentReceiverId: string | null
  isMaster: boolean
  detailsError: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const paymentMovements = useMemo(
    () => movements
      .filter((movement) => movement.movementType === "PAYMENT")
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
    [movements]
  )
  const secondaryMovements = useMemo(
    () => movements
      .filter((movement) => !["CHARGE", "PAYMENT"].includes(movement.movementType))
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
    [movements]
  )
  const visiblePayments = expanded ? paymentMovements : paymentMovements.slice(0, 5)
  const paymentDetails = useMemo(
    () => new Map(paymentDetailsData.map((payment) => [payment.id, payment])),
    [paymentDetailsData]
  )
  const visibleSecondary = expanded ? secondaryMovements : secondaryMovements.slice(0, 2)
  const hasMore = paymentMovements.length > visiblePayments.length || secondaryMovements.length > visibleSecondary.length

  return (
    <section className="space-y-4" aria-labelledby="payment-history">
      <div>
        <h2 id="payment-history" className="text-base font-semibold">Historial de pagos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagos recibidos para la cuenta global del alumno.
        </p>
      </div>

      {paymentMovements.length ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visiblePayments.map((payment) => (
                  <PaymentTableRow
                    key={payment.id}
                    movement={payment}
                    payment={paymentDetails.get(payment.id)}
                    charges={charges}
                    studentId={studentId}
                    currentReceiverId={currentReceiverId}
                    isMaster={isMaster}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border border-y border-border md:hidden">
            {visiblePayments.map((payment) => (
              <PaymentMobileRow
                key={payment.id}
                movement={payment}
                payment={paymentDetails.get(payment.id)}
                charges={charges}
                studentId={studentId}
                currentReceiverId={currentReceiverId}
                isMaster={isMaster}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="border-y border-border py-5 text-sm text-muted-foreground">
          Aún no hay pagos registrados para este alumno.
        </p>
      )}

      {detailsError && (
        <p className="text-sm text-muted-foreground">
          No pudimos cargar los detalles de algunos pagos. Inténtalo de nuevo en unos momentos.
        </p>
      )}

      {visibleSecondary.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {visibleSecondary.map((movement) => <SecondaryMovement key={`${movement.movementType}-${movement.id}`} movement={movement} />)}
        </div>
      )}

      {(hasMore || expanded) && (
        <Button variant="outline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Mostrar menos" : "Ver todo el historial"}
        </Button>
      )}
    </section>
  )
}

function AmountCell({
  value,
  negative = false,
  emphasis = false,
}: {
  value: string
  negative?: boolean
  emphasis?: boolean
}) {
  return (
    <td className={["px-3 py-3 text-right align-top font-medium tabular-nums", emphasis ? "text-destructive" : ""].join(" ")}>
      {negative ? "-" : ""}{formatCurrency(value)}
    </td>
  )
}

function ChargeStatus({ charge }: { charge: StudentChargeBalance }) {
  const className = charge.isPaid
    ? "font-medium text-emerald-700"
    : charge.isOverdue
      ? "font-medium text-destructive"
      : "font-medium"

  return (
    <span className={className}>
      {chargeStatusLabel(charge)}
    </span>
  )
}

function MobileMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={["mt-1 text-sm font-medium tabular-nums", valueClassName].filter(Boolean).join(" ")}>
        {value}
      </dd>
    </div>
  )
}

function PaymentTableRow({
  movement,
  payment,
  charges,
  studentId,
  currentReceiverId,
  isMaster,
}: {
  movement: StudentAccountMovement
  payment: StudentPaymentDetail | undefined
  charges: StudentChargeBalance[]
  studentId: string
  currentReceiverId: string | null
  isMaster: boolean
}) {
  const reversed = movement.status === "REVERSED"

  return (
    <tr>
      <td className="px-4 py-3">{formatDate(movement.movementOn)}</td>
      <td className={[
        "px-4 py-3 text-right font-medium tabular-nums",
        reversed ? "text-muted-foreground line-through" : "text-emerald-700",
      ].join(" ")}>-{formatCurrency(movement.credit)}</td>
      <td className="px-4 py-3">
        <p>{paymentMethod(movement)}</p>
        <PaymentReceiver movement={movement} />
        {reversed && <p className="mt-1 text-xs font-medium text-destructive">Revertido</p>}
      </td>
      <td className="px-4 py-3 text-right">
        {payment && (
          <PaymentDetailsSheet
            studentId={studentId}
            payment={payment}
            charges={charges}
            canManage={canManagePayment(payment, currentReceiverId, isMaster)}
          />
        )}
      </td>
    </tr>
  )
}

function PaymentMobileRow({
  movement,
  payment,
  charges,
  studentId,
  currentReceiverId,
  isMaster,
}: {
  movement: StudentAccountMovement
  payment: StudentPaymentDetail | undefined
  charges: StudentChargeBalance[]
  studentId: string
  currentReceiverId: string | null
  isMaster: boolean
}) {
  const reversed = movement.status === "REVERSED"

  return (
    <article className="flex items-start justify-between gap-4 py-4 first:pt-3 last:pb-3">
      <div>
        <p className="text-sm font-medium">{formatDate(movement.movementOn)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{paymentMethod(movement)}</p>
        <PaymentReceiver movement={movement} />
        {reversed && <p className="mt-1 text-xs font-medium text-destructive">Revertido</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className={[
          "text-sm font-medium tabular-nums",
          reversed ? "text-muted-foreground line-through" : "text-emerald-700",
        ].join(" ")}>-{formatCurrency(movement.credit)}</p>
        {payment && (
          <PaymentDetailsSheet
            studentId={studentId}
            payment={payment}
            charges={charges}
            canManage={canManagePayment(payment, currentReceiverId, isMaster)}
          />
        )}
      </div>
    </article>
  )
}

function canManagePayment(
  payment: StudentPaymentDetail,
  currentReceiverId: string | null,
  isMaster: boolean
) {
  return isMaster || Boolean(currentReceiverId && payment.receivedByStaffId === currentReceiverId)
}

function PaymentReceiver({ movement }: { movement: StudentAccountMovement }) {
  if (!movement.receivedByNameSnapshot) return null

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Recibido por: {movement.receivedByNameSnapshot}
    </p>
  )
}

function SecondaryMovement({ movement }: { movement: StudentAccountMovement }) {
  return (
    <article className="flex items-start justify-between gap-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{secondaryLabel(movement.movementType)}</p>
        <p className="mt-1 text-muted-foreground">{formatDate(movement.movementOn)}</p>
      </div>
      <p className="shrink-0 font-medium tabular-nums">{formatSecondaryAmount(movement)}</p>
    </article>
  )
}

function groupChargesByCycle(charges: StudentChargeBalance[]) {
  const groups = new Map<string, CycleGroup>()

  for (const charge of charges) {
    const id = charge.cycleId || "sin-ciclo"
    const current = groups.get(id) ?? {
      id,
      label: shortCycleLabel(charge.cycleCode),
      charges: [],
      sortValue: 0,
    }
    current.charges.push(charge)
    current.sortValue = Math.max(current.sortValue, chargeSortValue(charge))
    groups.set(id, current)
  }

  return [...groups.values()].sort((left, right) => right.sortValue - left.sortValue)
}

function periodLabel(charge: StudentChargeBalance, format: "short" | "long") {
  if (charge.conceptCode === "ENROLLMENT_FEE") return format === "short" ? "INS" : "Inscripción"
  if (charge.coverageYear && charge.coverageMonth) {
    return new Intl.DateTimeFormat("es-MX", {
      month: format === "short" ? "short" : "long",
      year: format === "short" ? undefined : "numeric",
    })
      .format(new Date(charge.coverageYear, charge.coverageMonth - 1, 1))
      .replace(".", "")
      .toUpperCase()
  }

  return format === "short" ? (charge.conceptCode || charge.conceptName).slice(0, 3).toUpperCase() : charge.conceptName
}

function shortCycleLabel(value: string) {
  const years = value.match(/\d{2,4}/g)
  if (years?.length && years.length >= 2) {
    return `${years[0].slice(-2)}-${years[1].slice(-2)}`
  }

  return value || "Sin ciclo"
}

function chargeSortValue(charge: StudentChargeBalance) {
  if (charge.coverageYear && charge.coverageMonth) return charge.coverageYear * 12 + charge.coverageMonth
  return Date.parse(`${charge.dueDate}T12:00:00`) || 0
}

function chargeStatusLabel(charge: StudentChargeBalance) {
  if (charge.isPaid) return "Cubierto"
  return charge.isOverdue ? "Vencido" : "Pendiente"
}

function paymentMethod(movement: StudentAccountMovement) {
  const parts = movement.description.split(" · ")
  return parts.at(-1) || "Pago recibido"
}

function secondaryLabel(type: string) {
  return {
    CHARGE_ADJUSTMENT: "Ajuste a cargo",
    CHARGE_VOIDED: "Cargo anulado",
    PAYMENT_REVERSAL: "Pago revertido",
    REFUND: "Devolución registrada",
  }[type] ?? "Movimiento financiero"
}

function formatSecondaryAmount(movement: StudentAccountMovement) {
  const debit = amountNumber(movement.debit)
  const value = debit > 0 ? movement.debit : movement.credit
  return `${debit > 0 ? "" : "-"}${formatCurrency(value)}`
}

function sumAmounts(values: string[]) {
  return values.reduce((total, value) => total + amountNumber(value), 0).toFixed(2)
}

function amountNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}
