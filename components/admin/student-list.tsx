import { ChevronRight } from "lucide-react"
import Link from "next/link"

import type { StudentListItem } from "@/lib/admin/students"

export function StudentList({ students }: { students: StudentListItem[] }) {
  if (!students.length) {
    return (
      <div className="border-y border-border bg-white px-4 py-10 text-center">
        <p className="text-sm font-medium">No hay alumnos para estos filtros.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta la búsqueda o los filtros e inténtalo de nuevo.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-white lg:hidden">
        {students.map((student) => (
          <StudentMobileRow key={student.id} student={student} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Alumno</th>
              <th className="px-4 py-3">Grado / grupo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="w-10 px-4 py-3"><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b border-border last:border-b-0 hover:bg-muted/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/alumnos/${student.id}`}
                    className="font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {student.fullName}
                  </Link>
                  {student.studentCode && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {student.studentCode}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {student.enrollment
                    ? `${student.enrollment.gradeLevel.name}${student.enrollment.group ? ` · ${student.enrollment.group.name}` : ""}`
                    : "Sin matrícula actual"}
                </td>
                <td className="px-4 py-3">
                  {student.enrollment
                    ? formatEnrollmentStatus(student.enrollment.status)
                    : "Sin matrícula actual"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/alumnos/${student.id}`}
                    aria-label={`Abrir ficha de ${student.fullName}`}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function StudentMobileRow({ student }: { student: StudentListItem }) {
  return (
    <Link
      href={`/admin/alumnos/${student.id}`}
      className="flex min-h-[72px] items-center justify-between gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{student.fullName}</span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">
          {student.enrollment
            ? `${student.enrollment.gradeLevel.name}${student.enrollment.group ? ` · ${student.enrollment.group.name}` : ""} · ${formatEnrollmentStatus(student.enrollment.status)}`
            : "Sin matrícula en el ciclo operativo"}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function formatEnrollmentStatus(status: string) {
  const labels: Record<string, string> = {
    PREINSCRITA: "Preinscrita",
    PENDIENTE: "Pendiente",
    ACTIVA: "Activa",
    BAJA: "Baja",
    FINALIZADA: "Finalizada",
    NO_CONTINUA: "No continúa",
    EGRESADA: "Egresada",
  }

  return labels[status] ?? status
}
