import Link from "next/link"

import { OverdueStudentsTable, type OverdueStudent } from "@/components/admin/overdue-students-table"
import { StudentModuleNav } from "@/components/admin/student-module-nav"
import { formatCurrency } from "@/lib/admin/student-account"
import { getStudentCatalogs } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/server"

type OverduePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type OverdueDetailRow = {
  student_id: unknown
  student_name: unknown
  education_level_name: unknown
  grade_name: unknown
  concept_code: unknown
  coverage_year: unknown
  coverage_month: unknown
  outstanding_amount: unknown
}

export default async function OverdueStudentsPage({ searchParams }: OverduePageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)
  if (catalogsError || !catalogs) return <OverdueLoadError />

  const selectedCycleId = value(params.cycle)
  const selectedCycle = catalogs.cycles.find((cycle) => cycle.id === selectedCycleId)
  const overdueResult = selectedCycle
    ? await supabase.rpc("administrative_overdue_details", { p_cycle_id: selectedCycle.id })
    : await supabase.rpc("administrative_overdue_details")

  if (overdueResult.error) return <OverdueLoadError />

  const students = aggregateStudents((overdueResult.data as OverdueDetailRow[] | null) ?? [])
  const consolidatedDebt = students.reduce((total, student) => total + Number(student.outstandingAmount), 0)
  const debtByLevel = aggregateDebtByLevel((overdueResult.data as OverdueDetailRow[] | null) ?? [])
  const returnTo = selectedCycle
    ? `/admin/alumnos/adeudos?cycle=${encodeURIComponent(selectedCycle.id)}`
    : "/admin/alumnos/adeudos"

  return (
    <div className="space-y-7">
      <StudentModuleNav />
      <header className="space-y-4">
        <div>
          <Link
            href="/admin/alumnos"
            className="inline-flex min-h-9 items-center text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Alumnos
          </Link>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight sm:text-2xl">Adeudos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consulta global de obligaciones vencidas por alumno.</p>
        </div>

        <form action="/admin/alumnos/adeudos" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">
            <span className="text-xs text-muted-foreground">Vista</span>
            <select
              name="cycle"
              defaultValue={selectedCycle?.id ?? ""}
              className="h-10 min-w-52 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="">Todo</option>
              {catalogs.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>Por ciclo: {cycle.name}</option>)}
            </select>
          </label>
          <button className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Aplicar
          </button>
        </form>
      </header>

      <section aria-label="Resumen de deuda vencida" className="grid border-y border-border sm:grid-cols-3">
        <Metric label="Deuda consolidada" value={formatCurrency(consolidatedDebt.toFixed(2))} />
        <Metric label="Alumnos con deuda" value={String(students.length)} />
        <div className="px-4 py-4 sm:border-l sm:border-border">
          <p className="text-sm text-muted-foreground">Deuda por nivel</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
            {debtByLevel.map((item) => <span key={item.name}>{item.name}: {formatCurrency(item.amount.toFixed(2))}</span>)}
          </div>
        </div>
      </section>

      <OverdueStudentsTable students={students} returnTo={returnTo} />
    </div>
  )
}

function aggregateStudents(rows: OverdueDetailRow[]): OverdueStudent[] {
  const students = new Map<string, {
    studentId: string
    studentName: string
    contexts: Set<string>
    concepts: Map<string, { label: string; sortKey: string }>
    total: number
  }>()

  for (const row of rows) {
    const studentId = text(row.student_id)
    const outstandingAmount = amount(row.outstanding_amount)
    if (!studentId || outstandingAmount <= 0) continue

    const student = students.get(studentId) ?? {
      studentId,
      studentName: text(row.student_name),
      contexts: new Set<string>(),
      concepts: new Map<string, { label: string; sortKey: string }>(),
      total: 0,
    }
    const context = [text(row.education_level_name), text(row.grade_name)].filter(Boolean).join(" · ")
    if (context) student.contexts.add(context)
    const concept = displayConcept(row)
    student.concepts.set(concept.label, concept)
    student.total += outstandingAmount
    students.set(studentId, student)
  }

  return [...students.values()]
    .map((student) => ({
      studentId: student.studentId,
      studentName: student.studentName || "Alumno sin nombre",
      context: [...student.contexts].join(" / ") || "Sin contexto académico",
      concepts: compactConcepts([...student.concepts.values()]),
      outstandingAmount: student.total.toFixed(2),
    }))
    .sort((left, right) => Number(right.outstandingAmount) - Number(left.outstandingAmount))
}

function aggregateDebtByLevel(rows: OverdueDetailRow[]) {
  const totals = new Map<string, number>([["Preescolar", 0], ["Primaria", 0]])
  for (const row of rows) {
    const level = levelName(text(row.education_level_name))
    const outstandingAmount = amount(row.outstanding_amount)
    if (!level || outstandingAmount <= 0) continue
    totals.set(level, (totals.get(level) ?? 0) + outstandingAmount)
  }

  return [...totals.entries()].map(([name, amount]) => ({ name, amount }))
}

function displayConcept(row: OverdueDetailRow) {
  const month = integer(row.coverage_month)
  const year = integer(row.coverage_year)
  const code = text(row.concept_code)
  if (code === "ENROLLMENT_FEE") return { label: "INS", sortKey: "0-INS" }
  if (month && month >= 1 && month <= 12) {
    return {
      label: ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"][month - 1],
      sortKey: `1-${String(year ?? 0).padStart(4, "0")}-${String(month).padStart(2, "0")}`,
    }
  }
  return { label: code || "Otro", sortKey: `2-${code}` }
}

function compactConcepts(concepts: Array<{ label: string; sortKey: string }>) {
  const labels = concepts.sort((left, right) => left.sortKey.localeCompare(right.sortKey)).map((concept) => concept.label)
  return labels.length > 3 ? [...labels.slice(0, 3), `+${labels.length - 3}`] : labels
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function OverdueLoadError() {
  return (
    <div className="max-w-lg border-y border-border bg-white px-4 py-10">
      <h1 className="text-lg font-semibold">No pudimos cargar el financiero vencido.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p>
      <Link href="/admin/alumnos/adeudos" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">
        Intentar de nuevo
      </Link>
    </div>
  )
}

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : undefined
}

function text(input: unknown) {
  return typeof input === "string" ? input : ""
}

function integer(input: unknown) {
  const parsed = Number(input)
  return Number.isInteger(parsed) ? parsed : null
}

function amount(input: unknown) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function levelName(input: string) {
  const normalized = input.toLocaleLowerCase("es-MX")
  if (normalized === "preescolar") return "Preescolar"
  if (normalized === "primaria") return "Primaria"
  return input
}
