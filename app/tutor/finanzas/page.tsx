import { createClient } from "@/lib/supabase/server"
import { getTutorAccount, getTutorStudents, chooseTutorStudent } from "@/app/tutor/data"
import { StudentContext, StudentSelector } from "@/components/tutor/student-selector"
import { TutorNavigation } from "@/components/tutor/tutor-navigation"
import { TutorFinance } from "@/components/tutor/tutor-finance"

export default async function TutorFinancesPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const supabase = await createClient(); const { students, error } = await getTutorStudents(supabase); const { student } = await searchParams; const selected = chooseTutorStudent(students, student)
  if (error || !selected) return <main className="p-5 sm:p-8"><TutorNavigation current="finance" /><p className="mt-6 text-sm text-muted-foreground">No tienes alumnos autorizados.</p></main>
  const { account, error: accountError } = await getTutorAccount(supabase, selected.id)
  return <main className="mx-auto min-h-dvh max-w-5xl space-y-6 p-5 sm:p-8"><TutorNavigation current="finance" /><header className="space-y-3"><StudentContext student={selected} /><StudentSelector students={students} selectedId={selected.id} hrefBase="/tutor/finanzas" /></header>{accountError || !account ? <p className="text-sm text-destructive">No pudimos cargar el estado de cuenta.</p> : <TutorFinance account={account} />}</main>
}
