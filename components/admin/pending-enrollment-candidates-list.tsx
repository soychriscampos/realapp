import { ChevronRight } from "lucide-react"
import Link from "next/link"

import type { BulkEnrollmentCandidate } from "@/lib/admin/bulk-enrollment"
import { formatEnrollmentStatus } from "@/lib/admin/enrollments"

type PendingEnrollmentCandidatesListProps = {
  candidates: BulkEnrollmentCandidate[]
}

export function PendingEnrollmentCandidatesList({ candidates }: PendingEnrollmentCandidatesListProps) {
  if (!candidates.length) {
    return (
      <div className="border-y border-border bg-white px-4 py-10 text-center">
        <p className="text-sm font-medium">No hay alumnos pendientes de continuidad.</p>
        <p className="mt-1 text-sm text-muted-foreground">Los alumnos del ciclo anterior ya tienen matrícula en este ciclo.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-white lg:hidden">
        {candidates.map((candidate) => <CandidateMobileRow key={candidate.studentId} candidate={candidate} />)}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Alumno</th>
              <th className="px-4 py-3">Contexto del ciclo anterior</th>
              <th className="px-4 py-3">Situación anterior</th>
              <th className="w-10 px-4 py-3"><span className="sr-only">Abrir ficha</span></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => <CandidateDesktopRow key={candidate.studentId} candidate={candidate} />)}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CandidateMobileRow({ candidate }: { candidate: BulkEnrollmentCandidate }) {
  return (
    <Link href={`/admin/alumnos/${candidate.studentId}`} className="flex min-h-[76px] items-center justify-between gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{candidate.fullName}</span>
        {candidate.studentCode && <span className="mt-0.5 block text-xs text-muted-foreground">{candidate.studentCode}</span>}
        <span className="mt-1 block truncate text-sm text-muted-foreground">Ciclo anterior · {candidate.previousGrade.educationLevelName} · {candidate.previousGrade.name}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function CandidateDesktopRow({ candidate }: { candidate: BulkEnrollmentCandidate }) {
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/60">
      <td className="px-4 py-3">
        <Link href={`/admin/alumnos/${candidate.studentId}`} className="block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="font-medium">{candidate.fullName}</span>
          {candidate.studentCode && <span className="mt-0.5 block text-xs text-muted-foreground">{candidate.studentCode}</span>}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{candidate.previousGrade.educationLevelName} · {candidate.previousGrade.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatEnrollmentStatus(candidate.previousStatus)}</td>
      <td className="px-4 py-3"><ChevronRight className="size-4 text-muted-foreground" /></td>
    </tr>
  )
}
