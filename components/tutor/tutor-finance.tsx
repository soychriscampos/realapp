"use client"

import { useMemo, useState } from "react"
import { formatCurrency, isChargeVisibleInCycle } from "@/lib/admin/student-account"
import type { TutorAccount, TutorTuitionAgreement } from "@/app/tutor/data"

export function TutorFinance({ account, cycleId, tuition }: { account: TutorAccount; cycleId: string | null; tuition: TutorTuitionAgreement | null }) {
  const charges = account.charges.filter((charge) => isChargeVisibleInCycle(charge) && (!cycleId || charge.cycleId === cycleId))
  const overdueTotal = charges.reduce((total, charge) => total + (charge.isOverdue && Number(charge.outstandingAmount) > 0 ? Number(charge.outstandingAmount) : 0), 0).toFixed(2)
  const status = Number(overdueTotal) > 0 ? "Vencido" : "Al corriente"

  return <div className="space-y-7">
    <section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Saldo actual</p><p className="mt-1 text-3xl font-semibold tabular-nums">{formatCurrency(overdueTotal)}</p></div><p className={status === "Vencido" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-emerald-700"}>{status}</p></div>
      {tuition?.hasMultipleAmounts ? <p className="mt-3 text-sm text-muted-foreground">Colegiatura: tuvo cambios durante este ciclo</p> : tuition?.agreedAmount !== null && tuition?.agreedAmount !== undefined ? <p className="mt-3 text-sm text-muted-foreground">Colegiatura: {formatCurrency(tuition.agreedAmount)}</p> : <p className="mt-3 text-sm text-muted-foreground">No hay colegiatura contractual disponible para este ciclo.</p>}
      {status === "Al corriente" && <p className="mt-3 text-sm text-muted-foreground">Gracias por mantener tus pagos al día.</p>}
    </section>
    <section><h2 className="text-base font-semibold">Estado de cuenta</h2>{charges.length ? <ChargeTable charges={charges} /> : <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">No hay cargos financieros registrados para este ciclo.</p>}</section>
    <PaymentHistory payments={account.payments} />
  </div>
}

function ChargeTable({ charges }: { charges: TutorAccount["charges"] }) {
  return <><div className="mt-4 hidden overflow-hidden rounded-xl border border-border bg-white md:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="w-[32%] px-4 py-3 font-medium">Periodo</th><th className="w-[17%] px-3 py-3 text-right font-medium">Importe</th><th className="w-[17%] px-3 py-3 text-right font-medium">Aplicado</th><th className="w-[17%] px-3 py-3 text-right font-medium">Saldo</th><th className="w-[17%] px-4 py-3 text-right font-medium">Estado</th></tr></thead><tbody className="divide-y divide-border">{charges.map((charge) => <tr key={charge.id}><td className="px-4 py-3 align-top"><p className="font-medium">{periodLabel(charge.conceptCode, charge.coverageYear, charge.coverageMonth, "short")}</p><p className="mt-1 text-xs text-muted-foreground">{charge.conceptName}</p></td><AmountCell value={charge.effectiveAmount} /><AmountCell value={charge.totalApplied} negative /><AmountCell value={charge.outstandingAmount} emphasis={charge.isOverdue} /><td className="px-4 py-3 text-right align-top"><ChargeStatus charge={charge} /></td></tr>)}</tbody></table></div><div className="mt-4 divide-y divide-border border-y border-border md:hidden">{charges.map((charge) => <article key={charge.id} className="py-4 first:pt-3 last:pb-3"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium">{periodLabel(charge.conceptCode, charge.coverageYear, charge.coverageMonth, "long")}</p><p className="mt-1 text-sm text-muted-foreground">{charge.conceptName}</p></div><p className="shrink-0 text-base font-semibold tabular-nums">{formatCurrency(charge.effectiveAmount)}</p></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><MobileMetric label="Aplicado" value={`-${formatCurrency(charge.totalApplied)}`} /><MobileMetric label="Saldo" value={formatCurrency(charge.outstandingAmount)} valueClassName={charge.isOverdue ? "text-destructive" : undefined} /><MobileMetric label="Estado" value={charge.isPaid ? "Pagado" : charge.isOverdue ? "Vencido" : "Pendiente"} valueClassName={charge.isPaid ? "text-emerald-700" : charge.isOverdue ? "text-destructive" : undefined} /></dl></article>)}</div></>
}

function PaymentHistory({ payments }: { payments: TutorAccount["payments"] }) {
  const [expanded, setExpanded] = useState(false)
  const orderedPayments = useMemo(() => [...payments].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)), [payments])
  const visiblePayments = expanded ? orderedPayments : orderedPayments.slice(0, 10)
  return <section><h2 className="text-base font-semibold">Historial de pagos</h2>{visiblePayments.length ? <><div className="mt-4 divide-y divide-border border-y border-border bg-white md:rounded-xl md:border">{visiblePayments.map((payment) => <div key={payment.id} className="grid gap-1 px-4 py-4 text-sm sm:grid-cols-3 sm:gap-4"><span>{formatDate(payment.receivedAt)}</span><span className="font-medium tabular-nums">{formatCurrency(payment.amount)}</span><span className="text-muted-foreground">{payment.methodName} · {payment.receivedByName}</span></div>)}</div>{orderedPayments.length > 10 && <button type="button" className="mt-3 text-sm font-medium underline-offset-4 hover:underline" onClick={() => setExpanded((value) => !value)}>{expanded ? "Ver menos" : "Ver más"}</button>}</> : <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">No hay pagos registrados.</p>}</section>
}

function AmountCell({ value, negative = false, emphasis = false }: { value: string; negative?: boolean; emphasis?: boolean }) { return <td className={`px-3 py-3 text-right align-top tabular-nums${emphasis ? " font-medium text-destructive" : ""}`}>{negative ? "-" : ""}{formatCurrency(value)}</td> }
function ChargeStatus({ charge }: { charge: TutorAccount["charges"][number] }) { return <span className={charge.isPaid ? "text-emerald-700" : charge.isOverdue ? "text-destructive" : ""}>{charge.isPaid ? "Pagado" : charge.isOverdue ? "Vencido" : "Pendiente"}</span> }
function MobileMetric({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 text-sm font-medium tabular-nums${valueClassName ? ` ${valueClassName}` : ""}`}>{value}</dd></div> }
function periodLabel(conceptCode: string, year: number | null, month: number | null, _length?: "short" | "long") { void _length; if (conceptCode === "ENROLLMENT_FEE") return "Inscripción"; if (!year || !month) return "Sin periodo"; return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)).toLocaleUpperCase("es-MX") }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value)) }
