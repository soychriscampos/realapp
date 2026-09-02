import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getStudentChargeBalances } from "@/lib/admin/student-account"
import { chooseTutorStudent, getTutorStudents, getTutorSummaries } from "@/app/tutor/data"
import { StudentContext, StudentSelector } from "@/components/tutor/student-selector"
import { TutorNavigation } from "@/components/tutor/tutor-navigation"

export default async function TutorPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const supabase = await createClient(); const { students, error } = await getTutorStudents(supabase)
  if (error) return <TutorShell current="home"><p className="text-sm text-destructive">No pudimos cargar tus alumnos.</p></TutorShell>
  if (!students.length) return <TutorShell current="home"><h1 className="text-2xl font-semibold">Familia</h1><p className="mt-2 text-sm text-muted-foreground">No tienes alumnos autorizados.</p></TutorShell>
  const selectedStudent = chooseTutorStudent(students, (await searchParams).student)
  const [summaries, charges] = await Promise.all([getTutorSummaries(supabase, students), Promise.all(students.map((student) => getStudentChargeBalances(supabase, student.id)))])
  const outstanding = students.reduce((total, student) => total + Number(summaries.get(student.id)?.outstandingTotal ?? 0), 0)
  const periods = [...new Set(charges.flatMap((result) => result.data.filter((charge) => Number(charge.outstandingAmount) > 0 && charge.coverageYear && charge.coverageMonth).map((charge) => periodLabel(charge.coverageYear!, charge.coverageMonth!))))]
  const studentIds = students.map((student) => student.id)
  const { data: payments } = await supabase.from("payments").select("student_id, amount, received_at, method_name_snapshot, students!inner(full_name)").in("student_id", studentIds).eq("status", "POSTED").order("received_at", { ascending: false }).limit(8)
  const hasDebt = outstanding > 0
  return <TutorShell current="home"><div className="space-y-7"><header className="space-y-3"><StudentContext student={selectedStudent!} /><StudentSelector students={students} selectedId={selectedStudent!.id} hrefBase="/tutor" /></header><section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border"><p className={hasDebt ? "text-sm font-semibold text-destructive" : "text-sm font-semibold"}>{hasDebt ? "Tienes un saldo pendiente" : "Estás al corriente"}</p>{hasDebt ? <><p className="mt-2 text-3xl font-semibold tabular-nums">{formatCurrency(outstanding)}</p><p className="mt-2 text-sm text-muted-foreground">Periodos pendientes: {periods.length ? periods.join(", ") : "Consulta el detalle por alumno."}</p></> : <p className="mt-2 text-sm text-muted-foreground">Gracias por mantener tus pagos al día.</p>}</section><section><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Pagos recientes</h2><Link href="/tutor/finanzas" className="text-sm font-medium underline-offset-4 hover:underline">Ver finanzas</Link></div>{payments?.length ? <div className="mt-4 divide-y divide-border border-y border-border bg-white md:rounded-xl md:border">{payments.map((payment) => { const student = Array.isArray(payment.students) ? payment.students[0] : payment.students; return <div key={`${payment.student_id}-${payment.received_at}-${payment.amount}`} className="grid gap-1 px-4 py-4 text-sm sm:grid-cols-4 sm:gap-4"><span>{formatDate(payment.received_at)}</span><span className="font-medium">{student?.full_name ?? "Alumno"}</span><span className="tabular-nums">{formatCurrency(String(payment.amount))}</span><span className="text-muted-foreground">{payment.method_name_snapshot}</span></div> })}</div> : <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">No hay pagos recientes.</p>}</section></div></TutorShell>
}
function TutorShell({ current, children }: { current: "home" | "info" | "finance"; children: React.ReactNode }) { return <main className="mx-auto min-h-dvh max-w-5xl space-y-6 p-5 sm:p-8"><TutorNavigation current={current} /><div>{children}</div></main> }
function periodLabel(year: number, month: number) { return new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date(year, month - 1, 1)) }
function formatCurrency(value: string | number) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value)) }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value)) }
