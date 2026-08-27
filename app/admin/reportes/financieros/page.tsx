import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { requireRole } from "@/lib/auth/require-role"

type FinancialReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type PaymentReportingRow = {
  payment_id: unknown
  payment_code: unknown
  student_code: unknown
  student_name: unknown
  received_at: unknown
  refunded_amount: unknown
  net_amount: unknown
  payment_status: unknown
  method_name: unknown
  received_by_name: unknown
}

type GroupedPayment = { label: string; payments: number; net: number }

export default async function FinancialReportPage({ searchParams }: FinancialReportPageProps) {
  const { supabase } = await requireRole(["MASTER"])
  const params = await searchParams
  const today = mazatlanDate()
  const defaultFrom = today.slice(0, 7) + "-01"
  const from = validDate(value(params.from)) ? value(params.from)! : defaultFrom
  const to = validDate(value(params.to)) ? value(params.to)! : today
  const result = await supabase.rpc("payment_reporting", { p_from: from, p_to: to })

  if (result.error) return <ReportLoadError />
  const rows = ((result.data as PaymentReportingRow[] | null) ?? []).filter((row) => Number.isFinite(Number(row.net_amount)))
  const net = rows.reduce((sum, row) => sum + number(row.net_amount), 0)
  const refunded = rows.reduce((sum, row) => sum + number(row.refunded_amount), 0)
  const methods = groupPayments(rows, (row) => text(row.method_name) || "Sin método")
  const receivers = groupPayments(rows, (row) => text(row.received_by_name) || "Sin receptor")
  const monthlyIncome = monthlyIncomeSeries(rows, from, to)

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link href="/admin/reportes" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronLeft className="size-4" /> Reportes
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Reporte financiero</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresos netos del periodo seleccionado.</p>
        </div>
        <form action="/admin/reportes/financieros" className="flex flex-wrap items-end gap-3">
          <DateField label="Desde" name="from" value={from} />
          <DateField label="Hasta" name="to" value={to} />
          <button className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Aplicar</button>
        </form>
      </header>

      <section aria-label="Indicadores financieros" className="grid border-y border-border sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ingresos netos" value={formatCurrency(net)} />
        <Metric label="Pagos" value={String(rows.length)} />
        <Metric label="Promedio por pago" value={formatCurrency(rows.length ? net / rows.length : 0)} />
        <Metric label="Reembolsado" value={formatCurrency(refunded)} />
      </section>

      <MonthlyIncomeSection points={monthlyIncome} />

      {rows.length === 0 ? <EmptyReport /> : (
        <div className="space-y-7">
          <GroupedTable title="Por método" firstLabel="Método" rows={methods} />
          <GroupedTable title="Por receptor" firstLabel="Recibió" rows={receivers} />
          <PaymentsTable rows={rows.slice().sort((left, right) => text(right.received_at).localeCompare(text(left.received_at)))} />
        </div>
      )}
    </div>
  )
}

type MonthlyIncomePoint = { key: string; label: string; net: number; payments: number }

function monthlyIncomeSeries(rows: PaymentReportingRow[], from: string, to: string) {
  const totals = new Map<string, { net: number; payments: number }>()
  for (const row of rows) {
    const key = mazatlanMonth(row.received_at)
    if (!key) continue
    const current = totals.get(key) ?? { net: 0, payments: 0 }
    current.net += number(row.net_amount)
    current.payments += 1
    totals.set(key, current)
  }

  const months = monthKeys(from, to)
  const includesYears = new Set(months.map((month) => month.slice(0, 4))).size > 1
  return months.map((key) => {
    const [year, month] = key.split("-")
    const current = totals.get(key) ?? { net: 0, payments: 0 }
    return {
      key,
      label: includesYears ? `${MONTH_LABELS[Number(month) - 1]} ${year}` : MONTH_LABELS[Number(month) - 1],
      ...current,
    }
  })
}

function MonthlyIncomeSection({ points }: { points: MonthlyIncomePoint[] }) {
  return (
    <section className="space-y-3" aria-labelledby="monthly-income-title">
      <div>
        <h2 id="monthly-income-title" className="text-base font-semibold">Evolución de ingresos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ingresos netos por mes calendario.</p>
      </div>
      {points.length ? <MonthlyIncomeChart points={points} /> : <p className="border-y border-border py-5 text-sm text-muted-foreground">Selecciona un rango de fechas válido.</p>}
    </section>
  )
}

function MonthlyIncomeChart({ points }: { points: MonthlyIncomePoint[] }) {
  const width = 720
  const height = 250
  const left = 58
  const right = 16
  const top = 18
  const bottom = 42
  const max = Math.max(...points.map((point) => point.net), 1)
  const x = (index: number) => left + (index * (width - left - right)) / Math.max(points.length - 1, 1)
  const y = (net: number) => top + (height - top - bottom) * (1 - net / max)
  const line = points.map((point, index) => `${x(index)},${y(point.net)}`).join(" ")

  return (
    <div className="border-y border-border bg-white px-3 py-4 sm:px-5">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="monthly-income-chart-title monthly-income-chart-description" className="h-auto min-w-[620px] w-full">
          <title id="monthly-income-chart-title">Evolución mensual de ingresos netos</title>
          <desc id="monthly-income-chart-description">Ingresos netos y cantidad de pagos por mes del rango seleccionado.</desc>
          <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="currentColor" className="text-border" />
          <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="currentColor" className="text-border" />
          <text x={left - 8} y={top + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{formatCurrency(max)}</text>
          <text x={left - 8} y={height - bottom + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">$0</text>
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground" />
          {points.map((point, index) => (
            <g key={point.key}>
              <title>{`${point.label}: ${formatCurrency(point.net)}, ${point.payments} ${point.payments === 1 ? "pago" : "pagos"}`}</title>
              <circle cx={x(index)} cy={y(point.net)} r="4" fill="currentColor" className="text-foreground" />
              <text x={x(index)} y={height - 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-4 overflow-x-auto border-t border-border pt-3">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-2 py-2">Mes</th><th className="px-2 py-2 text-right">Ingresos</th><th className="px-2 py-2 text-right">Pagos</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((point) => <tr key={point.key}><td className="px-2 py-2 font-medium">{point.label}</td><td className="px-2 py-2 text-right tabular-nums">{formatCurrency(point.net)}</td><td className="px-2 py-2 text-right tabular-nums">{point.payments}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DateField({ label, name, value }: { label: string; name: string; value: string }) {
  return <label className="grid gap-1 text-sm font-medium"><span className="text-xs text-muted-foreground">{label}</span><input type="date" name={name} defaultValue={value} className="h-10 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>
}

function GroupedTable({ title, firstLabel, rows }: { title: string; firstLabel: string; rows: GroupedPayment[] }) {
  return <section className="space-y-3"><h2 className="text-base font-semibold">{title}</h2><div className="overflow-hidden rounded-xl border border-border bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{firstLabel}</th><th className="px-4 py-3 text-right">Pagos</th><th className="px-4 py-3 text-right">Neto</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.label}><td className="max-w-[18rem] truncate px-4 py-3 font-medium">{row.label}</td><td className="px-4 py-3 text-right tabular-nums">{row.payments}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(row.net)}</td></tr>)}</tbody></table></div></section>
}

function PaymentsTable({ rows }: { rows: PaymentReportingRow[] }) {
  return <section className="space-y-3"><div><h2 className="text-base font-semibold">Pagos del periodo</h2><p className="mt-1 text-sm text-muted-foreground">Mostrando los 50 movimientos más recientes.</p></div><div className="overflow-hidden rounded-xl border border-border bg-white"><div className="divide-y divide-border sm:hidden">{rows.slice(0, 50).map((row) => <article key={text(row.payment_id)} className="space-y-1 px-4 py-3"><div className="flex items-baseline justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium">{text(row.student_name) || "Alumno sin nombre"}</p><p className="shrink-0 font-medium tabular-nums">{formatCurrency(number(row.net_amount))}</p></div><p className="text-xs text-muted-foreground">{formatDateTime(row.received_at)} · {text(row.method_name) || "Sin método"}</p><p className="text-xs text-muted-foreground">Recibió: {text(row.received_by_name) || "Sin receptor"}</p></article>)}</div><div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Alumno</th><th className="px-4 py-3">Método</th><th className="px-4 py-3">Recibió</th><th className="px-4 py-3 text-right">Neto</th></tr></thead><tbody className="divide-y divide-border">{rows.slice(0, 50).map((row) => <tr key={text(row.payment_id)}><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(row.received_at)}</td><td className="max-w-[16rem] truncate px-4 py-3 font-medium">{text(row.student_name) || "Alumno sin nombre"}</td><td className="px-4 py-3">{text(row.method_name) || "Sin método"}</td><td className="px-4 py-3">{text(row.received_by_name) || "Sin receptor"}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(number(row.net_amount))}</td></tr>)}</tbody></table></div></div></section>
}

function groupPayments(rows: PaymentReportingRow[], getLabel: (row: PaymentReportingRow) => string) {
  const groups = new Map<string, GroupedPayment>()
  for (const row of rows) {
    const label = getLabel(row)
    const current = groups.get(label) ?? { label, payments: 0, net: 0 }
    current.payments += 1
    current.net += number(row.net_amount)
    groups.set(label, current)
  }
  return [...groups.values()].sort((left, right) => right.net - left.net || left.label.localeCompare(right.label, "es"))
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p></div> }
function EmptyReport() { return <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No hay pagos en el periodo seleccionado.</p><p className="mt-1 text-sm text-muted-foreground">Ajusta las fechas e inténtalo de nuevo.</p></div> }
function ReportLoadError() { return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar el reporte financiero.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/reportes/financieros" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div> }
function mazatlanDate() { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mazatlan", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}` }
function validDate(input: string | undefined): input is string { return Boolean(input && /^\d{4}-\d{2}-\d{2}$/.test(input)) }
function value(input: string | string[] | undefined) { return typeof input === "string" ? input : undefined }
function text(input: unknown) { return typeof input === "string" ? input : "" }
function number(input: unknown) { const result = Number(input); return Number.isFinite(result) ? result : 0 }
function formatCurrency(input: number) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(input) }
function formatDateTime(input: unknown) { const date = new Date(text(input)); return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mazatlan" }).format(date) }

const MONTH_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]

function mazatlanMonth(input: unknown) {
  const date = new Date(text(input))
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mazatlan", year: "numeric", month: "2-digit" }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}`
}

function monthKeys(from: string, to: string) {
  const start = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
  const keys: string[] = []
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth() + 1
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`)
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return keys
}
