"use client"

import { useState } from "react"

import { EnrollmentFilters } from "@/components/admin/enrollment-filters"
import { EnrollmentList } from "@/components/admin/enrollment-list"
import { PendingEnrollmentCandidatesList, type PendingActivationProps } from "@/components/admin/pending-enrollment-candidates-list"
import type { BulkEnrollmentCandidate, NoContinuaCandidate } from "@/lib/admin/bulk-enrollment"
import type { EnrollmentListItem } from "@/lib/admin/enrollments"

type Option = { id: string; name: string }

type Props = {
  situation: string
  enrollments: EnrollmentListItem[]
  pendingCandidates: BulkEnrollmentCandidate[]
  noContinuaCandidates: NoContinuaCandidate[]
  pendingLoadError: boolean
  pendingContextKey: string
  pendingActivationProps: PendingActivationProps
  pendingCycle: { id: string; name: string; starts_on: string }
  pendingPreviousCycleName: string
  filterValues: Record<string, string | undefined>
  situations: Option[]
  levels: Option[]
  grades: Array<Option & { education_level_id: string }>
  groups: Array<Option & { code: string; grade_level_id: string; cycle_id: string }>
  classifications: Option[]
}

export function EnrollmentSituationResults({
  situation,
  enrollments,
  pendingCandidates,
  noContinuaCandidates,
  pendingLoadError,
  pendingContextKey,
  pendingActivationProps,
  pendingCycle,
  pendingPreviousCycleName,
  filterValues,
  situations,
  levels,
  grades,
  groups,
  classifications,
}: Props) {
  const [query, setQuery] = useState("")
  const visibleEnrollments = enrollments.filter((enrollment) => matchesQuery(`${enrollment.student.fullName} ${enrollment.student.studentCode ?? ""}`, query))
  const visiblePendingCandidates = pendingCandidates.filter((candidate) => matchesQuery(`${candidate.fullName} ${candidate.studentCode ?? ""}`, query))
  const total = visibleEnrollments.length + visiblePendingCandidates.length
  const pendingOnly = situation === "pending"

  return (
    <>
      <EnrollmentFilters
        values={filterValues}
        situations={situations}
        levels={levels}
        grades={grades}
        groups={groups}
        classifications={classifications}
        applied
        query={query}
        onQueryChange={setQuery}
      />
      <section aria-label="Matrículas del ciclo" className="space-y-3">
        {pendingLoadError && pendingOnly ? (
          <div className="border-y border-border bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium">No pudimos cargar los alumnos pendientes de continuidad.</p>
            <p className="mt-1 text-sm text-muted-foreground">Actualiza la página e inténtalo de nuevo.</p>
          </div>
        ) : query.trim() && total === 0 ? (
          <div className="border-y border-border bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium">No se encontraron coincidencias.</p>
          </div>
        ) : (
          <>
            {!pendingOnly && visibleEnrollments.length > 0 && <EnrollmentList key={`active:${pendingContextKey}`} enrollments={visibleEnrollments} resultCount={`${total} resultado${total === 1 ? "" : "s"}`} />}
            {visiblePendingCandidates.length > 0 && (
              <div className="space-y-3">
                {!pendingOnly && <h2 className="text-sm font-medium">Pendientes de continuidad</h2>}
                <PendingEnrollmentCandidatesList key={`pending:${pendingContextKey}`} candidates={visiblePendingCandidates} noContinuaCandidates={noContinuaCandidates} cycle={pendingCycle} previousCycleName={pendingPreviousCycleName} loadError={pendingLoadError} resultCount={pendingOnly ? `${visiblePendingCandidates.length} pendiente${visiblePendingCandidates.length === 1 ? "" : "s"} de continuidad` : undefined} activationProps={pendingActivationProps} />
              </div>
            )}
            {!visibleEnrollments.length && !visiblePendingCandidates.length && !pendingLoadError && (
              pendingOnly
                ? <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No hay alumnos pendientes de continuidad.</p><p className="mt-1 text-sm text-muted-foreground">Los alumnos del ciclo anterior ya tienen matrícula en este ciclo.</p></div>
                : <EnrollmentList key={`active:${pendingContextKey}`} enrollments={[]} />
            )}
          </>
        )}
      </section>
    </>
  )
}

function matchesQuery(value: string, query: string) {
  const normalizedQuery = normalizeSearch(query)
  return !normalizedQuery || normalizeSearch(value).includes(normalizedQuery)
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim()
}
