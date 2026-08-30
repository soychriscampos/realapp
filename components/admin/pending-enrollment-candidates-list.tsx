"use client"

import { Menu } from "@base-ui/react/menu"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { BulkEnrollmentActivationSheet } from "@/components/admin/bulk-enrollment-activation-sheet"
import { BulkNoContinuaSheet } from "@/components/admin/bulk-no-continua-sheet"
import { EnrollmentSelectionToolbar } from "@/components/admin/enrollment-selection-toolbar"
import { useEnrollmentSelection } from "@/components/admin/use-enrollment-selection"
import { Button } from "@/components/ui/button"
import type { BulkEnrollmentCandidate, NoContinuaCandidate } from "@/lib/admin/bulk-enrollment"
import { formatEnrollmentStatus } from "@/lib/admin/enrollments"

export type PendingActivationProps = {
  levels: Array<{ id: string; name: string; sort_order: number }>
  grades: Array<{ id: string; name: string; education_level_id: string; sort_order: number }>
  groups: Array<{ id: string; name: string; code: string; cycle_id: string; grade_level_id: string }>
  classifications: Array<{ id: string; name: string }>
  financialCoverage: import("@/lib/admin/enrollments").EnrollmentFinancialCoverage[]
  discountCategories: import("@/lib/admin/discount-categories").TuitionDiscountCategory[]
}

type Props = {
  candidates: BulkEnrollmentCandidate[]
  noContinuaCandidates: NoContinuaCandidate[]
  cycle: { id: string; name: string; starts_on: string }
  previousCycleName: string
  loadError: boolean
  resultCount?: string
  activationProps: PendingActivationProps
}

export function PendingEnrollmentCandidatesList({ candidates, noContinuaCandidates, cycle, previousCycleName, loadError, resultCount, activationProps }: Props) {
  const selectableKeys = candidates.map((candidate) => candidate.studentId)
  const selection = useEnrollmentSelection({ availableKeys: selectableKeys })
  const [action, setAction] = useState<"activation" | "noContinua" | null>(null)
  const selectedCandidates = candidates.filter((candidate) => selection.selectedKeySet.has(candidate.studentId))
  const selectedNoContinua = noContinuaCandidates.filter((candidate) => selection.selectedKeySet.has(candidate.studentId))
  const canActivate = selectedCandidates.length > 0
  const canMarkNoContinua = selectedNoContinua.length > 0

  if (!candidates.length) {
    return <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">{loadError ? "No pudimos cargar los alumnos pendientes de continuidad." : "No hay alumnos pendientes de continuidad."}</p><p className="mt-1 text-sm text-muted-foreground">{loadError ? "Actualiza la página e inténtalo de nuevo." : "Los alumnos del ciclo anterior ya tienen matrícula en este ciclo."}</p></div>
  }

const actions = <><Menu.Root><Menu.Trigger render={<Button variant="outline" className="h-10">Acciones</Button>} /><Menu.Portal><Menu.Positioner align="end" sideOffset={6}><Menu.Popup className="z-50 min-w-56 rounded-xl border border-border bg-white p-1 shadow-lg outline-none"><Menu.Item disabled={!canActivate} onClick={() => setAction("activation")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Activar seleccionados</Menu.Item><Menu.Item disabled={!canMarkNoContinua} onClick={() => setAction("noContinua")} className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted">Marcar no continúa</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root><BulkEnrollmentActivationSheet key={selectedCandidates.map((candidate) => candidate.studentId).join(",")} cycle={cycle} selectedCandidates={selectedCandidates} levels={activationProps.levels} grades={activationProps.grades} groups={activationProps.groups} classifications={activationProps.classifications} financialCoverage={activationProps.financialCoverage} discountCategories={activationProps.discountCategories} open={action === "activation"} onOpenChange={(open) => !open && setAction(null)} /><BulkNoContinuaSheet cycle={cycle} previousCycleName={previousCycleName} candidates={selectedNoContinua} open={action === "noContinua"} onOpenChange={(open) => !open && setAction(null)} /></>

  return <><div className="flex flex-wrap items-center justify-between gap-3">{!selection.isSelecting && resultCount ? <span className="text-sm text-muted-foreground">{resultCount}</span> : <span />}<EnrollmentSelectionToolbar {...selection} selectableCount={selectableKeys.length} onEnter={selection.enterSelectionMode} onExit={selection.exitSelectionMode} onToggleAll={selection.toggleAll} actions={actions} /></div><div className="overflow-hidden rounded-xl border border-border bg-white lg:hidden">{candidates.map((candidate) => <CandidateMobileRow key={candidate.studentId} candidate={candidate} selecting={selection.isSelecting} selected={selection.selectedKeySet.has(candidate.studentId)} onToggle={() => selection.toggle(candidate.studentId)} />)}</div><div className="hidden overflow-hidden rounded-xl border border-border bg-white lg:block"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="w-10 px-4 py-3"><span className="sr-only">Seleccionar</span></th><th className="px-4 py-3">Alumno</th><th className="px-4 py-3">Contexto del ciclo anterior</th><th className="px-4 py-3">Situación anterior</th><th className="w-10 px-4 py-3"><span className="sr-only">Abrir ficha</span></th></tr></thead><tbody>{candidates.map((candidate) => <CandidateDesktopRow key={candidate.studentId} candidate={candidate} selecting={selection.isSelecting} selected={selection.selectedKeySet.has(candidate.studentId)} onToggle={() => selection.toggle(candidate.studentId)} />)}</tbody></table></div></>
}

function CandidateMobileRow({ candidate, selecting, selected, onToggle }: { candidate: BulkEnrollmentCandidate; selecting: boolean; selected: boolean; onToggle: () => void }) {
  return <div className="flex min-h-[76px] items-center gap-2 border-b border-border px-2 last:border-b-0 hover:bg-muted/60">{selecting && <input aria-label={`Seleccionar a ${candidate.fullName}`} type="checkbox" checked={selected} onChange={onToggle} className="ml-1 size-4 shrink-0" />}<Link href={`/admin/alumnos/${candidate.studentId}`} className="flex min-w-0 flex-1 items-center justify-between gap-4 px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span className="min-w-0"><span className="block truncate text-sm font-medium">{candidate.fullName}</span><span className="mt-1 block truncate text-sm text-muted-foreground">Ciclo anterior · {candidate.previousGrade.educationLevelName} · {candidate.previousGrade.name}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link></div>
}

function CandidateDesktopRow({ candidate, selecting, selected, onToggle }: { candidate: BulkEnrollmentCandidate; selecting: boolean; selected: boolean; onToggle: () => void }) {
  return <tr className="border-b border-border last:border-b-0 hover:bg-muted/60"><td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>{selecting && <input aria-label={`Seleccionar a ${candidate.fullName}`} type="checkbox" checked={selected} onChange={onToggle} className="size-4" />}</td><td className="px-4 py-3"><Link href={`/admin/alumnos/${candidate.studentId}`} className="block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span className="font-medium">{candidate.fullName}</span></Link></td><td className="px-4 py-3 text-muted-foreground">{candidate.previousGrade.educationLevelName} · {candidate.previousGrade.name}</td><td className="px-4 py-3 text-muted-foreground">{formatEnrollmentStatus(candidate.previousStatus)}</td><td className="px-4 py-3"><ChevronRight className="size-4 text-muted-foreground" /></td></tr>
}
