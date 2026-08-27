import { StudentList } from "@/components/admin/student-list"
import { StudentListSearch } from "@/components/admin/student-list-search"
import { StudentModuleNav } from "@/components/admin/student-module-nav"
import { getStudents } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

type StudentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const query = paramValue(params.query)?.trim() ?? ""
  const result = query
    ? await getStudents(supabase, { globalSearch: true, query })
    : { data: [], error: false }

  if (result.error) return <StudentLoadError />

  return (
    <div className="space-y-6">
      <StudentModuleNav />
      <header className="space-y-4">
        <div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Alumnos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Encuentra cualquier alumno del colegio y abre su ficha.
            </p>
          </div>
        </div>
        <StudentListSearch key={query} initialValue={query} />
      </header>

      {query ? (
        <section aria-label="Resultados de alumnos" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {result.data.length === 50
              ? "Mostrando los primeros 50 alumnos. Refina la búsqueda para ver menos resultados."
              : `${result.data.length} alumno${result.data.length === 1 ? "" : "s"}`}
          </p>
          <StudentList students={result.data} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Busca un alumno por nombre para abrir su ficha.</p>
      )}
    </div>
  )
}

function StudentLoadError() {
  return (
    <div className="max-w-lg border-y border-border bg-white px-4 py-10">
      <h1 className="text-lg font-semibold">No pudimos cargar los alumnos.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Inténtalo de nuevo en unos momentos.
      </p>
      <Link href="/admin/alumnos" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">
        Intentar de nuevo
      </Link>
    </div>
  )
}

function paramValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined
}
