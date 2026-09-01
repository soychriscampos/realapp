import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { getStudentCatalogs } from "@/lib/admin/students"
import {
  buildTuitionValueReport,
  type TuitionValueReport,
  type TuitionValueRow,
} from "@/lib/admin/tuition-value-report"
import { requireRole } from "@/lib/auth/require-role"

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function TuitionValueReportPage({ searchParams }: PageProps) {
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const params = await searchParams
  const { catalogs, error } = await getStudentCatalogs(supabase)
  if (error || !catalogs) return <ReportLoadError />

  const requestedCycle = value(params.cycle)
  const cycle = catalogs.cycles.find((item) => item.id === requestedCycle) ?? catalogs.operationalCycle ?? catalogs.cycles[0]
  if (!cycle) return <ReportLoadError />

  const asOf = validDate(value(params.asOf)) ? value(params.asOf)! : mazatlanDate()
  const requestedLevel = value(params.level) ?? ""
  const level = catalogs.levels.some((item) => item.id === requestedLevel) ? requestedLevel : ""
  if (requestedCycle !== cycle.id || value(params.asOf) !== asOf || requestedLevel !== level) {
    const query = new URLSearchParams({ cycle: cycle.id, asOf })
    if (level) query.set("level", level)
    redirect(`/admin/reportes/valor-matricula?${query.toString()}`)
  }

  const result = await supabase.rpc("tuition_value_reporting", {
    p_cycle_id: cycle.id,
    p_as_of: asOf,
    p_education_level_id: level || null,
  })
  if (result.error) return <ReportLoadError />

  const report = buildTuitionValueReport((result.data as TuitionValueRow[] | null) ?? [], asOf)
  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link href="/admin/reportes" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronLeft className="size-4" /> Reportes
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Valor de matrícula</h1>
          <p className="mt-1 text-sm text-muted-foreground">Valor económico mensual de las matrículas activas y beneficios otorgados. Corte al {formatDate(asOf)}.</p>
        </div>
        <form action="/admin/reportes/valor-matricula" className="flex flex-wrap items-end gap-3">
          <Field label="Ciclo escolar"><select name="cycle" defaultValue={cycle.id} className={fieldClass}>{catalogs.cycles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Nivel"><select name="level" defaultValue={level} className={fieldClass}><option value="">Todos</option>{catalogs.levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Fecha"><input type="date" name="asOf" defaultValue={asOf} className={fieldClass} /></Field>
          <button className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Aplicar</button>
        </form>
      </header>

      <KpiSection report={report} />
      {report.current.missingFinancialAgreementCount > 0 && <p className="border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{report.current.missingFinancialAgreementCount} {report.current.missingFinancialAgreementCount === 1 ? "matrícula activa no tiene una condición financiera disponible" : "matrículas activas no tienen una condición financiera disponible"} y no {report.current.missingFinancialAgreementCount === 1 ? "está" : "están"} incluida{report.current.missingFinancialAgreementCount === 1 ? "" : "s"} en los cálculos de valor.</p>}
      {report.hasPartialHistory && <p className="border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Parte del histórico proviene de registros migrados y puede no representar con exactitud su situación en esa fecha.</p>}
      <Evolution report={report} />
      <ValueByLevel report={report} />
      <BenefitComposition report={report} />
    </div>
  )
}

const fieldClass = "h-10 min-w-44 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"

function KpiSection({ report }: { report: TuitionValueReport }) {
  const m = report.current
  return <section aria-label="Indicadores de valor de matrícula" className="grid border-y border-border sm:grid-cols-2 xl:grid-cols-3">
    <Metric label="Valor matrícula" value={currency(m.effectiveValue)} detail={`${percent(m.priceRetention)} del precio lista`} />
    <Metric label="Colegiatura promedio" value={currency(m.averageTuition)} />
    <Metric label="Precio lista" value={currency(m.listPriceValue)} />
    <Metric label="Beneficios" value={currency(m.benefitValue)} detail={`${percent(m.benefitRateValue)} del precio lista`} />
    <Metric label="Alumnos" value={String(m.studentCount)} />
    <Metric label="Alumnos valorizados" value={String(m.valuedStudentCount)} detail={m.missingFinancialAgreementCount ? `${m.missingFinancialAgreementCount} sin acuerdo` : undefined} />
    <Metric label="Con beneficio" value={String(m.benefitedStudents)} detail={`${percent(m.benefitRate)} de los valorizados`} />
  </section>
}

function Evolution({ report }: { report: TuitionValueReport }) {
  return <section className="space-y-3"><div><h2 className="text-base font-semibold">Evolución del valor de matrícula</h2><p className="mt-1 text-sm text-muted-foreground">Fotografía al último día natural de cada mes.</p></div><div className="overflow-x-auto border-y border-border bg-white"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Mes</th><th className="px-4 py-3 text-right">Alumnos</th><th className="px-4 py-3 text-right">Precio lista</th><th className="px-4 py-3 text-right">Valor efectivo</th><th className="px-4 py-3 text-right">Beneficios</th></tr></thead><tbody className="divide-y divide-border">{report.evolution.map((point) => <tr key={point.date}><td className="px-4 py-3 font-medium">{point.label}</td><td className="px-4 py-3 text-right tabular-nums">{point.studentCount}</td><td className="px-4 py-3 text-right tabular-nums">{currency(point.listPriceValue)}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{currency(point.effectiveValue)}</td><td className="px-4 py-3 text-right tabular-nums">{currency(point.benefitValue)}</td></tr>)}</tbody></table></div></section>
}

function ValueByLevel({ report }: { report: TuitionValueReport }) {
  const groups = report.levelBreakdown.flatMap((level) => [level, ...report.gradeBreakdown.filter((grade) => grade.levelId === level.levelId)])
  return <section className="space-y-3"><div><h2 className="text-base font-semibold">Valor por nivel y grado</h2><p className="mt-1 text-sm text-muted-foreground">Importe mensual contractual de las matrículas activas.</p></div><div className="overflow-x-auto border-y border-border bg-white"><table className="w-full min-w-[58rem] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Nivel / grado</th><th className="px-4 py-3 text-right">Alumnos</th><th className="px-4 py-3 text-right">Valor matrícula</th><th className="px-4 py-3 text-right">Promedio</th><th className="px-4 py-3 text-right">Precio lista</th><th className="px-4 py-3 text-right">Beneficios</th></tr></thead><tbody className="divide-y divide-border">{groups.map((row) => <tr key={`${row.levelId}:${row.gradeId ?? "total"}`} className={row.gradeId ? "" : "bg-muted/30"}><td className="px-4 py-3"><span className="font-semibold">{row.gradeId ? row.gradeName : `Subtotal ${row.levelName}`}</span>{row.gradeId && <span className="block text-xs text-muted-foreground">{row.levelName}</span>}</td><td className="px-4 py-3 text-right tabular-nums">{row.studentCount}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{currency(row.effectiveValue)}</td><td className="px-4 py-3 text-right tabular-nums">{currency(row.averageTuition)}</td><td className="px-4 py-3 text-right tabular-nums">{currency(row.listPriceValue)}</td><td className="px-4 py-3 text-right tabular-nums">{currency(row.benefitValue)}</td></tr>)}</tbody></table></div></section>
}

function BenefitComposition({ report }: { report: TuitionValueReport }) {
  const m = report.current
  return <section className="space-y-5"><div><h2 className="text-base font-semibold">Composición de beneficios</h2><p className="mt-1 text-sm text-muted-foreground">{m.fullPriceStudents} alumnos a precio completo · {m.benefitedStudents} con beneficio ({percent(m.benefitRate)}).</p></div><div><h3 className="mb-3 text-sm font-semibold">Beneficios por categoría</h3>{report.benefitCategories.length ? <div className="overflow-x-auto border-y border-border bg-white"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Categoría</th><th className="px-4 py-3 text-right">Alumnos</th><th className="px-4 py-3 text-right">Beneficio mensual</th><th className="px-4 py-3 text-right">Beneficio promedio</th></tr></thead><tbody className="divide-y divide-border">{report.benefitCategories.map((row) => <tr key={row.categoryId}><td className="px-4 py-3 font-medium">{row.categoryName}</td><td className="px-4 py-3 text-right tabular-nums">{row.studentCount}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{currency(row.benefitValue)}</td><td className="px-4 py-3 text-right tabular-nums">{currency(row.averageBenefit)}</td></tr>)}</tbody></table></div> : <p className="border-y border-border py-5 text-sm text-muted-foreground">No hay beneficios otorgados en este corte.</p>}</div></section>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1 text-sm font-medium"><span className="text-xs text-muted-foreground">{label}</span>{children}</label> }
function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div> }
function ReportLoadError() { return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar el valor de matrícula.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/reportes/valor-matricula" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div> }
function value(input: string | string[] | undefined) { return typeof input === "string" ? input : undefined }
function validDate(input: string | undefined): input is string { return Boolean(input && /^\d{4}-\d{2}-\d{2}$/.test(input)) }
function number(input: number) { return Number.isFinite(input) ? input : 0 }
function currency(input: number) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(number(input)) }
function percent(input: number) { return `${(number(input) * 100).toFixed(1)}%` }
function formatDate(input: string) { return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${input}T12:00:00Z`)) }
function mazatlanDate() { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mazatlan", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}` }
