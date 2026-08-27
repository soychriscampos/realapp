import { StudentFilters } from "@/components/admin/student-filters"
import { StudentList } from "@/components/admin/student-list"
import { StudentListSearch } from "@/components/admin/student-list-search"
import { StudentModuleNav } from "@/components/admin/student-module-nav"
import { getGroupsForCycle, getStudentCatalogs, getStudents } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

type StudentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError || !catalogs) return <StudentLoadError />

  const values = {
    query: paramValue(params.query),
    cycle: paramValue(params.cycle),
    level: paramValue(params.level),
    grade: paramValue(params.grade),
    group: paramValue(params.group),
    status: paramValue(params.status),
    classification: paramValue(params.classification),
  }

  const [groups, result] = await Promise.all([
    getGroupsForCycle(supabase, values.cycle ?? catalogs.operationalCycle?.id),
    getStudents(supabase, {
      contextCycleId: catalogs.operationalCycle?.id,
      cycleId: values.cycle,
      educationLevelId: values.level,
      gradeLevelId: values.grade,
      groupId: values.group,
      status: values.status,
      classificationId: values.classification,
      query: values.query,
    }),
  ])

  if (groups === null || result.error) return <StudentLoadError />

  return (
    <div className="space-y-6">
      <StudentModuleNav />
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Alumnos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulta y abre el contexto actual de cada alumno.
            </p>
          </div>
          <Link
            href="/admin/alumnos/adeudos"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Con adeudo
          </Link>
        </div>
        <StudentListSearch key={values.query ?? ""} initialValue={values.query ?? ""} />
      </header>

      <StudentFilters
        values={values}
        cycles={catalogs.cycles}
        levels={catalogs.levels}
        grades={catalogs.grades}
        groups={groups}
        classifications={catalogs.classifications}
      />

      <section aria-label="Resultados de alumnos" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {result.data.length === 50
            ? "Mostrando los primeros 50 alumnos. Refina la búsqueda para ver menos resultados."
            : `${result.data.length} alumno${result.data.length === 1 ? "" : "s"}`}
        </p>
        <StudentList students={result.data} />
      </section>
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
