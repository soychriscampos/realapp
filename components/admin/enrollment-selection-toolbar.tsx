"use client"

import { ListChecks, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  isSelecting: boolean
  selectedCount: number
  selectableCount: number
  allSelected: boolean
  someSelected: boolean
  onEnter: () => void
  onExit: () => void
  onToggleAll: () => void
  actions?: React.ReactNode
}

export function EnrollmentSelectionToolbar({
  isSelecting,
  selectedCount,
  selectableCount,
  allSelected,
  someSelected,
  onEnter,
  onExit,
  onToggleAll,
  actions,
}: Props) {
  if (!selectableCount) return null

  if (!isSelecting) {
    return <Button variant="outline" className="h-10" onClick={onEnter}><ListChecks /> Seleccionar</Button>
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button variant="outline" className="h-10" onClick={onToggleAll} aria-pressed={allSelected}>
        <span className="hidden sm:inline">{allSelected ? "Quitar selección" : "Seleccionar todos"}</span>
        <span className="sm:hidden">{allSelected ? "Quitar todos" : "Todos"}</span>
      </Button>
      <span className="px-1 text-sm text-muted-foreground" aria-live="polite">
        {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
      </span>
      <Button variant="ghost" className="h-10" onClick={onExit}><X /> Cancelar</Button>
      {someSelected || allSelected ? actions : null}
    </div>
  )
}
