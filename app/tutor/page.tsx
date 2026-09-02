import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getStudentChargeBalances } from "@/lib/admin/student-account"
import { chooseTutorCycle, chooseTutorStudent, getTutorCycles, getTutorRecentPayments, getTutorStudents, getTutorSummaries } from "@/app/tutor/data"
import { CycleSelector, StudentContext, StudentSelector } from "@/components/tutor/student-selector"
import { TutorNavigation } from "@/components/tutor/tutor-navigation"

export default async function TutorPage({ searchParams }: { searchParams: Promise<{ student?: string; cycle?: string }> }) {
  const supabase = await createClient(); const { students, error } = await getTutorStudents(supabase)
  if (error) return <TutorShell current="home"><p className="text-sm text-destructive">No pudimos cargar tus alumnos.</p></TutorShell>
  if (!students.length) return <TutorShell current="home"><h1 className="text-2xl font-semibold">Familia</h1><p className="mt-2 text-sm text-muted-foreground">No tienes alumnos autorizados.</p></TutorShell>
  const query = await searchParams
  const selectedStudent = chooseTutorStudent(students, query.student)
  const [cyclesResult, summaries, charges, payments] = await Promise.all([getTutorCycles(supabase, selectedStudent!.id), getTutorSummaries(supabase, students), Promise.all(students.map((student) => getStudentChargeBalances(supabase, student.id))), getTutorRecentPayments(supabase, students)])
  const selectedCycle = chooseTutorCycle(cyclesResult.cycles, query.cycle)
  const outstanding = students.reduce((total, student) => total + Number(summaries.get(student.id)?.outstandingTotal ?? 0), 0)
  const allCurrent = students.every((student) => summaries.get(student.id)?.isCurrent === true)
  const periods = [...new Set(charges.flatMap((result) => result.data.filter((charge) => Number(charge.outstandingAmount) > 0 && charge.coverageYear && charge.coverageMonth).map((charge) => periodLabel(charge.coverageYear!, charge.coverageMonth!))))]
  const hasDebt = !allCurrent
  return <TutorShell current="home" studentId={selectedStudent!.id} cycleId={selectedCycle?.id}><div className="space-y-7"><header className="space-y-3"><StudentContext student={selectedStudent!} /><StudentSelector students={students} selectedId={selectedStudent!.id} hrefBase="/tutor" cycleId={selectedCycle?.id} /><CycleSelector cycles={cyclesResult.cycles} selectedId={selectedCycle?.id ?? ""} studentId={selectedStudent!.id} hrefBase="/tutor" /></header><section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border"><p className={hasDebt ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-emerald-700"}>{hasDebt ? "Tienes un saldo pendiente" : "Estás al corriente"}</p>{hasDebt ? <><p className="mt-2 text-3xl font-semibold tabular-nums">{formatCurrency(outstanding)}</p><p className="mt-2 text-sm text-muted-foreground">Periodos pendientes: {periods.length ? periods.join(", ") : "Consulta el detalle por alumno."}</p></> : <p className="mt-2 text-sm text-muted-foreground">Gracias por mantener tus pagos al día.</p>}</section><section><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Pagos recientes</h2><Link href={`/tutor/finanzas?student=${selectedStudent!.id}${selectedCycle ? `&cycle=${selectedCycle.id}` : ""}`} className="text-sm font-medium underline-offset-4 hover:underline">Ver finanzas</Link></div>{payments.length ? <div className="mt-4 divide-y divide-border border-y border-border bg-white md:rounded-xl md:border">{payments.map((payment) => <div key={payment.id} className="grid gap-1 px-4 py-4 text-sm sm:grid-cols-4 sm:gap-4"><span>{formatDate(payment.receivedAt)}</span><span className="font-medium">{payment.studentName}</span><span className="tabular-nums">{formatCurrency(payment.amount)}</span><span className="text-muted-foreground">{payment.methodName}</span></div>)}</div> : <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">No hay pagos recientes.</p>}</section></div></TutorShell>
}
function TutorShell({ current, studentId, cycleId, children }: { current: "home" | "info" | "finance"; studentId?: string; cycleId?: string; children: React.ReactNode }) { return <main className="mx-auto min-h-dvh max-w-5xl space-y-6 p-5 sm:p-8"><TutorNavigation current={current} studentId={studentId} cycleId={cycleId} /><div>{children}</div></main> }
function periodLabel(year: number, month: number) { return new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date(year, month - 1, 1)) }
function formatCurrency(value: string | number) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value)) }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value)) }
