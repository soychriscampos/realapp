"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { formatEnrollmentStatus, getEnrollmentGroupLabel, type EnrollmentListItem } from "@/lib/admin/enrollments"

export function EnrollmentList({
  enrollments,
}: {
  enrollments: EnrollmentListItem[]
}) {
  if (!enrollments.length) {
    return (
      <div className="border-y border-border bg-white px-4 py-10 text-center">
        <p className="text-sm font-medium">No hay matrículas en esta vista.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los filtros o registra una nueva matrícula.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-white lg:hidden">
        {enrollments.map((enrollment) => (
          <div key={enrollment.id} className="flex min-h-[76px] items-center gap-2 border-b border-border px-2 last:border-b-0 hover:bg-muted/60">
            <Link
              href={`/admin/alumnos/${enrollment.student.id}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-4 px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{enrollment.student.fullName}</span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">
                  {enrollment.gradeLevel.name}
                  {enrollment.group ? ` · ${getEnrollmentGroupLabel(enrollment.group)}` : ""}
                </span>
                <span className="mt-1 block text-xs font-medium text-muted-foreground">{formatEnrollmentStatus(enrollment.status)}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Alumno</th>
              <th className="px-4 py-3">Nivel / grado</th>
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="w-10 px-4 py-3"><span className="sr-only">Abrir ficha</span></th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <EnrollmentDesktopRow key={enrollment.id} enrollment={enrollment} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EnrollmentDesktopRow({ enrollment }: { enrollment: EnrollmentListItem }) {
  const router = useRouter()
  const href = `/admin/alumnos/${enrollment.student.id}`

  return (
    <tr
      className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          router.push(href)
        }
      }}
      tabIndex={0}
    >
      <td className="px-4 py-3"><span className="font-medium">{enrollment.student.fullName}</span>{enrollment.student.studentCode && <span className="mt-0.5 block text-xs text-muted-foreground">{enrollment.student.studentCode}</span>}</td>
      <td className="px-4 py-3 text-muted-foreground">{enrollment.educationLevel.name} · {enrollment.gradeLevel.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{enrollment.group ? getEnrollmentGroupLabel(enrollment.group) : "Sin grupo"}</td>
      <td className="px-4 py-3">{formatEnrollmentStatus(enrollment.status)}</td>
      <td className="px-4 py-3"><ChevronRight className="size-4 text-muted-foreground" /></td>
    </tr>
  )
}
