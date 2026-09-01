import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getStudentCatalogs } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/server"

type EnrollmentReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type EnrollmentAsOfRow = {
  enrollment_id: unknown
  student_id: unknown
  student_code: unknown
  student_name: unknown
  sex: unknown
  cycle_id: unknown
  cycle_code: unknown
  education_level_id: unknown
  education_level_code: unknown
  education_level_name: unknown
  grade_level_id: unknown
  grade_code: unknown
  grade_name: unknown
  group_id: unknown
  classification_id: unknown
  classification_code: unknown
  classification_name: unknown
  counts_for_sep: unknown
  counts_for_campus: unknown
  status: unknown
  enrolled_on: unknown
  classes_start_on: unknown
  closed_on: unknown
  as_of: unknown
  history_quality: unknown
}

type EnrollmentStatusRow = {
  id: unknown
  status: unknown
}

type DistributionRow = {
  label: string
  men: number
  women: number
  unspecified: number
  total: number
  sortValue: number
}

type ReportScope = "campus" | "sep"

export default async function EnrollmentReportPage({ searchParams }: EnrollmentReportPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)
  if (catalogsError || !catalogs) return <ReportLoadError />

  const requestedCycleId = value(params.cycle)
  const selectedCycle = catalogs.cycles.find((cycle) => cycle.id === requestedCycleId)
    ?? catalogs.operationalCycle
    ?? catalogs.cycles[0]
  if (!selectedCycle) return <ReportLoadError />

  const requestedAsOf = value(params.asOf)
  const asOf = validDate(requestedAsOf) ? requestedAsOf : mazatlanDate()
  const scope: ReportScope = value(params.scope) === "sep" ? "sep" : "campus"
  if (requestedCycleId !== selectedCycle.id || requestedAsOf !== asOf || value(params.scope) !== scope) {
    redirect(`/admin/reportes/matricula?cycle=${encodeURIComponent(selectedCycle.id)}&asOf=${asOf}&scope=${scope}`)
  }

  const reportResult = await supabase.rpc("enrollment_as_of", {
    p_cycle_id: selectedCycle.id,
    p_as_of: asOf,
  })
  if (reportResult.error) return <ReportLoadError />

  const rows = (reportResult.data as EnrollmentAsOfRow[] | null) ?? []
  const currentStatusResult = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("cycle_id", selectedCycle.id)
  if (currentStatusResult.error) return <ReportLoadError />

  const currentStatusByEnrollment = new Map(
    ((currentStatusResult.data as EnrollmentStatusRow[] | null) ?? [])
      .map((row) => [text(row.id), text(row.status)] as const)
  )
  const currentRows = rows.map((row) => ({
    ...row,
    status: currentStatusByEnrollment.get(text(row.enrollment_id)) ?? row.status,
  }))
  const activeRows = currentRows.filter((row) => row.status === "ACTIVA")
  const campusRows = activeRows.filter((row) => row.counts_for_campus === true)
  const sepRows = activeRows.filter((row) => row.counts_for_sep === true)
  const campusStatusRows = currentRows.filter((row) => row.counts_for_campus === true)
  const levelOrder = new Map(catalogs.levels.map((level) => [level.id, level.sort_order]))
  const gradeOrder = new Map(catalogs.grades.map((grade) => [grade.id, grade.sort_order]))
  const reportRows = scope === "sep" ? sepRows : campusRows
  const levelDistribution = distributionByLevel(reportRows, levelOrder)
  const gradeDistribution = distributionByGrade(reportRows, levelOrder, gradeOrder)
  const classifications = classificationDistribution(campusRows)
  const statusDistributions = statusDistribution(campusStatusRows)
  const evolution = scope === "campus"
    ? await getEnrollmentEvolution(supabase, selectedCycle.id, selectedCycle.starts_on, selectedCycle.ends_on, selectedCycle.status, mazatlanDate(), campusRows.length)
    : []

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link
          href="/admin/reportes"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" />
          Reportes
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Reporte de matrícula</h1>
          <p className="mt-1 text-sm text-muted-foreground">Corte al {formatDate(asOf)}.</p>
        </div>
        <form action="/admin/reportes/matricula" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">
            <span className="text-xs text-muted-foreground">Vista</span>
            <select name="scope" defaultValue={scope} className="h-10 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50">
              <option value="campus">Campus</option>
              <option value="sep">SEP</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <span className="text-xs text-muted-foreground">Ciclo</span>
            <select
              name="cycle"
              defaultValue={selectedCycle.id}
              className="h-10 min-w-52 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              {catalogs.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <span className="text-xs text-muted-foreground">Fecha</span>
            <input
              type="date"
              name="asOf"
              defaultValue={asOf}
              className="h-10 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
          </label>
          <button className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Aplicar
          </button>
        </form>
      </header>

      <section aria-label="Indicadores de matrícula" className="grid border-y border-border sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={scope === "sep" ? "Matrícula SEP" : "Matrícula activa"} value={String(reportRows.length)} />
        <Metric label={scope === "sep" ? "Preescolar SEP" : "Matrícula SEP"} value={String(scope === "sep" ? countCampusByLevel(sepRows, "preescolar") : sepRows.length)} />
        <Metric label={scope === "sep" ? "Primaria SEP" : "Preescolar"} value={String(scope === "sep" ? countCampusByLevel(sepRows, "primaria") : countCampusByLevel(campusRows, "preescolar"))} />
        <Metric label={scope === "sep" ? "Fuera de SEP" : "Primaria"} value={String(scope === "sep" ? campusRows.filter((row) => row.counts_for_sep !== true).length : countCampusByLevel(campusRows, "primaria"))} />
      </section>

      {scope === "campus" && <EnrollmentEvolution points={evolution} />}

      {rows.length === 0 ? (
        <EmptyReport />
      ) : (
        <div className="space-y-7">
          <ReportTable title={scope === "sep" ? "Distribución SEP por nivel y sexo" : "Distribución por nivel"} rows={levelDistribution} />
          <ReportTable title={scope === "sep" ? "Distribución SEP por grado" : "Distribución por grado"} rows={gradeDistribution} />
          {scope === "campus" ? <><ClassificationSection rows={classifications} /><StatusSection rows={statusDistributions} /></> : <OutsideSepSection rows={campusRows.filter((row) => row.counts_for_sep !== true)} />}
        </div>
      )}
    </div>
  )
}

type EvolutionPoint = { date: string; label: string; count: number }

async function getEnrollmentEvolution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  startsOn: string,
  endsOn: string,
  status: string,
  today: string,
  currentActiveCount: number
): Promise<EvolutionPoint[]> {
  const lastDate = status === "ACTIVE" || status === "PREPARATION"
    ? (endsOn < today ? endsOn : today)
    : endsOn
  const cutDates = monthlyCutDates(startsOn, lastDate)
  if (!cutDates.length) return []

  const results = await Promise.all(cutDates.map((date) => supabase.rpc("enrollment_as_of", {
    p_cycle_id: cycleId,
    p_as_of: date,
  })))
  return results.map((result, index) => ({
    date: cutDates[index],
    label: formatMonth(cutDates[index]),
    count: index === results.length - 1
      ? currentActiveCount
      : result.error
        ? 0
        : ((result.data as EnrollmentAsOfRow[] | null) ?? []).filter((row) => row.status === "ACTIVA" && row.counts_for_campus === true).length,
  }))
}

function monthlyCutDates(startsOn: string, lastDate: string) {
  if (!startsOn || !lastDate || startsOn > lastDate) return []
  const dates = [startsOn]
  const start = new Date(`${startsOn}T12:00:00Z`)
  const last = new Date(`${lastDate}T12:00:00Z`)
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1
  while (true) {
    const monthEnd = new Date(Date.UTC(year, month, 0))
    if (monthEnd > last) break
    const date = monthEnd.toISOString().slice(0, 10)
    if (date !== startsOn) dates.push(date)
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  if (dates[dates.length - 1] !== lastDate) dates.push(lastDate)
  return dates
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(/\.$/, "")
    .toUpperCase()
}

function EnrollmentEvolution({ points }: { points: EvolutionPoint[] }) {
  return (
    <section className="space-y-3" aria-labelledby="enrollment-evolution-title">
      <div>
        <h2 id="enrollment-evolution-title" className="text-base font-semibold">Evolución de matrícula</h2>
        <p className="mt-1 text-sm text-muted-foreground">Matrícula campus por corte mensual.</p>
      </div>
      {points.length ? <EvolutionChart points={points} /> : (
        <p className="border-y border-border py-5 text-sm text-muted-foreground">No hay cortes disponibles para este ciclo.</p>
      )}
    </section>
  )
}

function EvolutionChart({ points }: { points: EvolutionPoint[] }) {
  const width = 720
  const height = 240
  const left = 58
  const right = 16
  const top = 18
  const bottom = 52
  const max = Math.max(...points.map((point) => point.count), 1)
  const x = (index: number) => left + (index * (width - left - right)) / Math.max(points.length - 1, 1)
  const y = (count: number) => top + (height - top - bottom) * (1 - count / max)
  const line = points.map((point, index) => `${x(index)},${y(point.count)}`).join(" ")

  return (
    <div className="border-y border-border bg-white px-3 py-4 sm:px-5">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="evolution-chart-title evolution-chart-description" className="h-auto min-w-[620px] w-full">
          <title id="evolution-chart-title">Evolución de matrícula campus</title>
          <desc id="evolution-chart-description">Cantidad de alumnos en cada corte mensual del ciclo.</desc>
          <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="currentColor" className="text-border" />
          <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="currentColor" className="text-border" />
          <text x="16" y={height / 2} textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`} className="fill-muted-foreground text-[11px]">Alumnos</text>
          <text x={left - 8} y={top + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{max}</text>
          <text x={left - 8} y={height - bottom + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">0</text>
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground" />
          {points.map((point, index) => (
            <g key={point.date}>
              <circle cx={x(index)} cy={y(point.count)} r="4" fill="currentColor" className="text-foreground" />
              <text x={x(index)} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[11px]">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-4 grid gap-x-4 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {points.map((point) => (
          <div key={point.date} className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{formatDate(point.date)}</span>
            <span className="font-medium tabular-nums">{point.count} alumnos</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportTable({ title, rows }: { title: string; rows: DistributionRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length ? (
        <>
          <div className="divide-y divide-border border-y border-border bg-white sm:hidden">
            {rows.map((row) => (
              <article key={row.label} className="px-4 py-4">
                <p className="text-sm font-medium">{row.label}</p>
                <dl className="mt-3 grid grid-cols-4 gap-3 text-sm">
                  <ReportMetric label="Hombres" value={row.men} />
                  <ReportMetric label="Mujeres" value={row.women} />
                  <ReportMetric label="Sin sexo" value={row.unspecified} />
                  <ReportMetric label="Total" value={row.total} emphasis />
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-white sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{title === "Distribución por nivel" ? "Nivel" : "Grado"}</th>
                <th className="px-4 py-3 text-right">Hombres</th>
                <th className="px-4 py-3 text-right">Mujeres</th>
                <th className="px-4 py-3 text-right">Sin sexo</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.men}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.women}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.unspecified}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <p className="border-y border-border py-5 text-sm text-muted-foreground">No hay matrícula campus para este corte.</p>
      )}
    </section>
  )
}

function ReportMetric({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={emphasis ? "mt-1 font-semibold tabular-nums" : "mt-1 font-medium tabular-nums"}>{value}</dd>
    </div>
  )
}

function ClassificationSection({ rows }: { rows: Array<{ label: string; campus: number; sep: number }> }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Clasificación</h2>
        <p className="mt-1 text-sm text-muted-foreground">Distribución según las clasificaciones de matrícula vigentes en el corte.</p>
      </div>
      {rows.length ? (
        <div className="divide-y divide-border border-y border-border bg-white">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-5 px-4 py-3 text-sm">
              <p className="min-w-0 truncate font-medium">{row.label}</p>
              <p className="text-right text-muted-foreground">Campus: <span className="font-medium text-foreground">{row.campus}</span></p>
              <p className="text-right text-muted-foreground">SEP: <span className="font-medium text-foreground">{row.sep}</span></p>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-y border-border py-5 text-sm text-muted-foreground">No hay clasificaciones registradas para este corte.</p>
      )}
    </section>
  )
}

function OutsideSepSection({ rows }: { rows: EnrollmentAsOfRow[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Fuera de SEP</h2>
        <p className="mt-1 text-sm text-muted-foreground">Alumnos campus que no cuentan para SEP en este corte.</p>
      </div>
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border sm:hidden">
            {rows.map((row) => <article key={text(row.enrollment_id)} className="space-y-1 px-4 py-3"><p className="text-sm font-medium">{text(row.student_name) || "Alumno sin nombre"}</p><p className="text-sm text-muted-foreground">{text(row.education_level_name) || "Sin nivel"} · {text(row.grade_name) || "Sin grado"}</p><p className="text-xs text-muted-foreground">{text(row.classification_name) || "Sin clasificación"}</p></article>)}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Alumno</th><th className="px-4 py-3">Nivel · Grado</th><th className="px-4 py-3">Clasificación</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={text(row.enrollment_id)}><td className="max-w-[18rem] truncate px-4 py-3 font-medium">{text(row.student_name) || "Alumno sin nombre"}</td><td className="px-4 py-3">{text(row.education_level_name) || "Sin nivel"} · {text(row.grade_name) || "Sin grado"}</td><td className="px-4 py-3">{text(row.classification_name) || "Sin clasificación"}</td></tr>)}</tbody></table>
          </div>
        </div>
      ) : <p className="border-y border-border py-5 text-sm text-muted-foreground">No hay alumnos fuera de SEP para este corte.</p>}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  )
}

function EmptyReport() {
  return (
    <div className="border-y border-border bg-white px-4 py-10 text-center">
      <p className="text-sm font-medium">No hay matrícula para este ciclo y fecha.</p>
      <p className="mt-1 text-sm text-muted-foreground">Ajusta el ciclo o la fecha de corte e inténtalo de nuevo.</p>
    </div>
  )
}

function ReportLoadError() {
  return (
    <div className="max-w-lg border-y border-border bg-white px-4 py-10">
      <h1 className="text-lg font-semibold">No pudimos cargar el reporte de matrícula.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p>
      <Link href="/admin/reportes/matricula" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">
        Intentar de nuevo
      </Link>
    </div>
  )
}

function distributionByLevel(rows: EnrollmentAsOfRow[], levelOrder: Map<string, number>) {
  const groups = new Map<string, DistributionRow>()
  for (const row of rows) {
    const levelId = text(row.education_level_id)
    const label = text(row.education_level_name) || "Sin nivel"
    const current = groups.get(levelId || label) ?? { label, men: 0, women: 0, unspecified: 0, total: 0, sortValue: levelOrder.get(levelId) ?? Number.MAX_SAFE_INTEGER }
    addSex(current, row.sex)
    groups.set(levelId || label, current)
  }
  return [...groups.values()].sort((left, right) => left.sortValue - right.sortValue || left.label.localeCompare(right.label, "es"))
}

function distributionByGrade(
  rows: EnrollmentAsOfRow[],
  levelOrder: Map<string, number>,
  gradeOrder: Map<string, number>
) {
  const groups = new Map<string, DistributionRow>()
  for (const row of rows) {
    const levelId = text(row.education_level_id)
    const gradeId = text(row.grade_level_id)
    const level = text(row.education_level_name) || "Sin nivel"
    const grade = text(row.grade_name) || "Sin grado"
    const key = `${levelId}:${gradeId}`
    const current = groups.get(key) ?? {
      label: `${grade} ${level}`,
      men: 0,
      women: 0,
      unspecified: 0,
      total: 0,
      sortValue: ((levelOrder.get(levelId) ?? 99) * 100) + (gradeOrder.get(gradeId) ?? 99),
    }
    addSex(current, row.sex)
    groups.set(key, current)
  }
  return [...groups.values()].sort((left, right) => left.sortValue - right.sortValue || left.label.localeCompare(right.label, "es"))
}

function classificationDistribution(rows: EnrollmentAsOfRow[]) {
  const groups = new Map<string, { label: string; campus: number; sep: number }>()
  for (const row of rows) {
    const code = text(row.classification_code)
    const label = text(row.classification_name) || code || "Sin clasificación"
    const current = groups.get(code || label) ?? { label, campus: 0, sep: 0 }
    if (row.counts_for_campus === true) current.campus += 1
    if (row.counts_for_sep === true) current.sep += 1
    groups.set(code || label, current)
  }
  return [...groups.values()].sort((left, right) => right.campus - left.campus || left.label.localeCompare(right.label, "es"))
}

type StatusDistributionRow = {
  status: string
  label: string
  total: number
  byLevel: DistributionRow[]
}

const separatedStatuses = [
  ["BAJA", "Bajas"],
  ["NO_CONTINUA", "No continúan"],
  ["FINALIZADA", "Finalizados"],
  ["EGRESADA", "Egresados"],
] as const

function statusDistribution(rows: EnrollmentAsOfRow[]): StatusDistributionRow[] {
  return separatedStatuses.flatMap(([status, label]) => {
    const statusRows = rows.filter((row) => row.status === status)
    return statusRows.length ? [{ status, label, total: statusRows.length, byLevel: distributionByLevel(statusRows, new Map()) }] : []
  })
}

function StatusSection({ rows }: { rows: StatusDistributionRow[] }) {
  return (
    <section className="space-y-3" aria-labelledby="enrollment-status-title">
      <div>
        <h2 id="enrollment-status-title" className="text-base font-semibold">Movimientos y estatus</h2>
        <p className="mt-1 text-sm text-muted-foreground">Estos estados se muestran aparte y no forman parte de la matrícula activa.</p>
      </div>
      <div className="divide-y divide-border border-y border-border bg-white">
        {rows.length ? rows.map((row) => (
          <div key={row.status} className="space-y-3 px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-lg font-semibold tabular-nums">{row.total}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {row.byLevel.map((level) => <span key={level.label}>{level.label}: <strong className="font-medium text-foreground">{level.total}</strong></span>)}
            </div>
          </div>
        )) : <p className="py-5 text-sm text-muted-foreground">No hay bajas, no continuidades, finalizaciones ni egresos registrados.</p>}
      </div>
    </section>
  )
}

function addSex(row: DistributionRow, sex: unknown) {
  row.total += 1
  if (sex === "H") row.men += 1
  else if (sex === "M") row.women += 1
  else row.unspecified += 1
}

function countCampusByLevel(rows: EnrollmentAsOfRow[], levelName: string) {
  return rows.filter((row) => text(row.education_level_name).toLocaleLowerCase("es-MX") === levelName).length
}

function mazatlanDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mazatlan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function validDate(input: string | undefined): input is string {
  return Boolean(input && /^\d{4}-\d{2}-\d{2}$/.test(input))
}

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : undefined
}

function text(input: unknown) {
  return typeof input === "string" ? input : ""
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}
