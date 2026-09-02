import { createClient } from "@/lib/supabase/server"
import { chooseTutorCycle, chooseTutorStudent, getTutorAccount, getTutorCycles, getTutorStudents, getTutorTuitionAgreement } from "@/app/tutor/data"
import { CycleSelector, StudentContext, StudentSelector } from "@/components/tutor/student-selector"
import { TutorNavigation } from "@/components/tutor/tutor-navigation"
import { TutorFinance } from "@/components/tutor/tutor-finance"

export default async function TutorFinancesPage({ searchParams }: { searchParams: Promise<{ student?: string; cycle?: string }> }) {
  const supabase = await createClient(); const { students, error } = await getTutorStudents(supabase); const query = await searchParams; const selected = chooseTutorStudent(students, query.student)
  if (error || !selected) return <main className="p-5 sm:p-8"><TutorNavigation current="finance" /><p className="mt-6 text-sm text-muted-foreground">No tienes alumnos autorizados.</p></main>
  const cyclesResult = await getTutorCycles(supabase, selected.id); const selectedCycle = chooseTutorCycle(cyclesResult.cycles, query.cycle)
  const [{ account, error: accountError }, tuitionResult] = await Promise.all([getTutorAccount(supabase, selected.id), selectedCycle ? getTutorTuitionAgreement(supabase, selected.id, selectedCycle.id) : Promise.resolve({ agreement: null, error: false })])
  return <main className="mx-auto min-h-dvh max-w-5xl space-y-6 p-5 sm:p-8"><TutorNavigation current="finance" studentId={selected.id} cycleId={selectedCycle?.id} /><header className="space-y-3"><StudentContext student={selected} /><StudentSelector students={students} selectedId={selected.id} hrefBase="/tutor/finanzas" cycleId={selectedCycle?.id} /><CycleSelector cycles={cyclesResult.cycles} selectedId={selectedCycle?.id ?? ""} studentId={selected.id} hrefBase="/tutor/finanzas" /></header>{accountError || !account ? <p className="text-sm text-destructive">No pudimos cargar el estado de cuenta.</p> : <TutorFinance account={account} cycleId={selectedCycle?.id ?? null} tuition={tuitionResult.agreement} />}</main>
}
