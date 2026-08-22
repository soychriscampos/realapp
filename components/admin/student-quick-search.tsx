"use client"

import { ChevronRight, Search } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { searchStudents, type StudentSearchResult } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/client"

export function StudentQuickSearch({
  cycleId,
  compact = false,
  focusTarget,
}: {
  cycleId?: string
  compact?: boolean
  focusTarget?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<StudentSearchResult[]>([])
  const [state, setState] = useState<"idle" | "loading" | "error" | "empty">(
    "idle"
  )

  useEffect(() => {
    const value = query.trim()

    if (value.length < 2) {
      return
    }

    const timeout = window.setTimeout(async () => {
      setState("loading")

      const { data, error } = await searchStudents(createClient(), value, cycleId)

      if (error) {
        setResults([])
        setState("error")
        return
      }

      setResults(data)
      setState(data.length ? "idle" : "empty")
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [cycleId, query])

  return (
    <div className="relative">
      <Search className={`pointer-events-none absolute left-3 ${compact ? "top-1/2 size-4" : "top-6 size-5"} -translate-y-1/2 text-muted-foreground`} />
      <Input
        data-search-target={focusTarget}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setResults([])
          setState("idle")
        }}
        placeholder="Nombre del alumno..."
        aria-label="Nombre del alumno"
        aria-describedby="student-search-status"
        className={compact ? "h-9 bg-white pl-9 text-sm" : "h-12 bg-white pl-11 text-base"}
      />

      <div id="student-search-status" aria-live="polite" className="sr-only">
        {state === "loading" ? "Buscando alumnos" : null}
        {state === "empty" ? "No encontramos alumnos" : null}
        {state === "error" ? "No pudimos buscar alumnos" : null}
      </div>

      {(state !== "idle" || results.length > 0) && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          {state === "loading" && (
            <div className="space-y-3 px-4 py-4" aria-hidden="true">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          )}

          {state === "error" && (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              No pudimos buscar alumnos. Inténtalo de nuevo.
            </p>
          )}

          {state === "empty" && (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              No encontramos alumnos con “{query.trim()}”.
            </p>
          )}

          {results.map((result) => (
            <Link
              key={result.id}
              href={`/admin/alumnos/${result.id}`}
              className="flex min-h-[68px] items-center justify-between gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {result.fullName}
                </span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">
                  {result.gradeName
                    ? `${result.gradeName}${result.groupName ? ` · ${result.groupName}` : ""}${result.status ? ` · ${formatEnrollmentStatus(result.status)}` : ""}`
                    : cycleId
                      ? "Sin matrícula en el ciclo operativo"
                      : "Abrir ficha del alumno"}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}

          <Link
            href={`/admin/alumnos?query=${encodeURIComponent(query.trim())}`}
            className="flex min-h-11 items-center px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Ver todos los resultados
          </Link>
        </div>
      )}
    </div>
  )
}

function formatEnrollmentStatus(status: string) {
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
