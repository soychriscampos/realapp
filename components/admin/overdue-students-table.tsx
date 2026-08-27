"use client"

import { ChevronRight, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/admin/student-account"

export type OverdueStudent = {
  studentId: string
  studentName: string
  context: string
  concepts: string[]
  outstandingAmount: string
}

export function OverdueStudentsTable({
  students,
  returnTo,
}: {
  students: OverdueStudent[]
  returnTo: string
}) {
  const [query, setQuery] = useState("")
  const filteredStudents = useMemo(() => {
    const term = normalize(query)
    if (!term) return students
    return students.filter((student) => normalize(student.studentName).includes(term))
  }, [query, students])

  return (
    <section aria-label="Alumnos con adeudo vencido" className="space-y-3">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar alumno..."
          aria-label="Buscar alumno con adeudo"
          className="h-11 bg-white pl-10"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filteredStudents.length} alumno{filteredStudents.length === 1 ? "" : "s"} con adeudo vencido
      </p>

      {filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
          {students.length ? "No encontramos alumnos con ese nombre." : "No hay adeudos vencidos para este filtro."}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-white lg:hidden">
            {filteredStudents.map((student) => (
              <Link
                key={student.studentId}
                href={studentHref(student.studentId, returnTo)}
                className="flex min-h-[82px] items-center justify-between gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{student.studentName}</span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">{student.context}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{student.concepts.join(" · ")}</span>
                  <span className="mt-1 block text-sm font-medium text-destructive">
                    {formatCurrency(student.outstandingAmount)} vencido
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Nivel · Grado</th>
                  <th className="px-4 py-3">Conceptos</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="w-10 px-4 py-3"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.studentId} className="border-b border-border last:border-b-0 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={studentHref(student.studentId, returnTo)}
                        className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {student.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{student.context}</td>
                    <td className="px-4 py-3 text-muted-foreground">{student.concepts.join(" · ")}</td>
                    <td className="px-4 py-3 text-right font-medium text-destructive">
                      {formatCurrency(student.outstandingAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={studentHref(student.studentId, returnTo)}
                        aria-label={`Abrir ficha de ${student.studentName}`}
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
      )}
    </section>
  )
}

function studentHref(studentId: string, returnTo: string) {
  return `/admin/alumnos/${studentId}?returnTo=${encodeURIComponent(returnTo)}`
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX")
}
