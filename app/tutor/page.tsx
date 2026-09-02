import { createClient } from "@/lib/supabase/server"

export default async function TutorPage() {
  const { data: students, error } = await (await createClient()).from("students").select("id, full_name, student_code").order("full_name")
  return <main className="space-y-6 p-5 sm:p-8"><div><h1 className="text-2xl font-semibold">Familia</h1><p className="mt-2 text-sm text-muted-foreground">Alumnos vinculados a tu acceso familiar.</p></div>{error ? <p className="text-sm text-destructive">No pudimos cargar tus alumnos.</p> : students?.length ? <div className="divide-y divide-border rounded-xl border border-border bg-white">{students.map((student) => <div key={student.id} className="px-4 py-4"><p className="text-sm font-medium">{student.full_name}</p>{student.student_code && <p className="mt-1 text-xs text-muted-foreground">{student.student_code}</p>}</div>)}</div> : <p className="text-sm text-muted-foreground">No tienes alumnos autorizados.</p>}</main>
}
