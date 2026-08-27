"use client"

import { Dialog } from "@base-ui/react/dialog"
import { useState } from "react"
import type { ChangeEvent } from "react"
import { Filter, X } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getEnrollmentGroupLabel } from "@/lib/admin/enrollments"

type Option = { id: string; name: string }

type StudentFiltersProps = {
  values: Record<string, string | undefined>
  cycles: Array<Option & { code: string }>
  levels: Option[]
  grades: Array<Option & { education_level_id: string }>
  groups: Array<Option & { grade_level_id: string; code: string }>
  classifications: Array<Option & { code: string }>
}

export function StudentFilters(props: StudentFiltersProps) {
  return (
    <>
      <form action="/admin/alumnos" className="hidden items-end gap-3 lg:flex">
        <FilterFields {...props} compact />
        <Button type="submit" variant="outline" className="h-10 bg-white">
          <Filter />
          Aplicar
        </Button>
        <ClearFilters />
      </form>

      <div className="lg:hidden">
        <Dialog.Root>
          <Dialog.Trigger render={<Button variant="outline" className="h-11 w-full bg-white" />}>
            <Filter />
            Filtros
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
            <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(92dvh,720px)] flex-col rounded-t-xl border-t border-border bg-white shadow-lg outline-none">
              <div className="flex min-h-14 items-center justify-between border-b border-border px-4 pt-[env(safe-area-inset-top)]">
                <Dialog.Title className="text-base font-semibold">Filtros</Dialog.Title>
                <Dialog.Close
                  aria-label="Cerrar filtros"
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <form action="/admin/alumnos" className="overflow-y-auto px-4 py-5">
                <FilterFields {...props} />
                <div className="mt-6 grid grid-cols-2 gap-3 pb-[env(safe-area-inset-bottom)]">
                  <ClearFilters />
                  <Button type="submit" className="h-12">
                    Aplicar filtros
                  </Button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </>
  )
}

function FilterFields({
  values,
  cycles,
  levels,
  grades,
  groups,
  classifications,
  compact = false,
}: StudentFiltersProps & { compact?: boolean }) {
  const [levelId, setLevelId] = useState(values.level ?? "")
  const [gradeId, setGradeId] = useState(values.grade ?? "")
  const [groupId, setGroupId] = useState(values.group ?? "")
  const filteredGrades = levelId
    ? grades.filter((grade) => grade.education_level_id === levelId)
    : grades
  const filteredGroups = gradeId
    ? groups.filter((group) => group.grade_level_id === gradeId)
    : levelId
      ? groups.filter((group) => filteredGrades.some((grade) => grade.id === group.grade_level_id))
      : groups
  const gradeOptions = filteredGrades.map((grade) => ({
    ...grade,
    name: levelId
      ? grade.name
      : `${levels.find((level) => level.id === grade.education_level_id)?.name ?? "Nivel"} · ${grade.name}`,
  }))
  const className = compact
    ? "flex items-end gap-3"
    : "grid gap-4 sm:grid-cols-2"

  return (
    <div className={className}>
      <FilterSelect
        label="Ciclo"
        name="cycle"
        value={values.cycle}
        options={cycles.map((cycle) => ({ id: cycle.id, name: cycle.name }))}
        compact={compact}
      />
      <FilterSelect
        label="Nivel"
        name="level"
        options={levels}
        compact={compact}
        value={levelId}
        onChange={(nextValue) => {
          setLevelId(nextValue)
          setGradeId("")
          setGroupId("")
        }}
      />
      <FilterSelect
        label="Grado"
        name="grade"
        options={gradeOptions}
        compact={compact}
        value={gradeId}
        onChange={(nextValue) => {
          setGradeId(nextValue)
          setGroupId("")
        }}
      />
      <FilterSelect
        label="Grupo"
        name="group"
        options={filteredGroups.map((group) => ({ ...group, name: getEnrollmentGroupLabel(group) }))}
        compact={compact}
        value={groupId}
        onChange={(nextValue) => setGroupId(nextValue)}
      />
      <FilterSelect
        label="Estado"
        name="status"
        value={values.status}
        options={enrollmentStatuses}
        compact={compact}
      />
      <FilterSelect
        label="Clasificación"
        name="classification"
        value={values.classification}
        options={classifications}
        compact={compact}
      />
      {values.query && <input type="hidden" name="query" value={values.query} />}
    </div>
  )
}

function FilterSelect({
  label,
  name,
  value,
  options,
  compact,
  onChange,
}: {
  label: string
  name: string
  value?: string
  options: Option[]
  compact: boolean
  onChange?: (value: string) => void
}) {
  return (
    <label className={compact ? "w-32" : "grid gap-2 text-sm font-medium"}>
      <span className={compact ? "mb-1 block text-xs text-muted-foreground" : ""}>
        {label}
      </span>
      <select
        name={name}
        {...(onChange
          ? {
              value: value ?? "",
              onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
            }
          : { defaultValue: value ?? "" })}
        className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ClearFilters() {
  return (
    <Link
      href="/admin/alumnos"
      className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Limpiar
    </Link>
  )
}

const enrollmentStatuses = [
  { id: "PREINSCRITA", name: "Preinscrita" },
  { id: "PENDIENTE", name: "Pendiente" },
  { id: "ACTIVA", name: "Activa" },
  { id: "BAJA", name: "Baja" },
  { id: "FINALIZADA", name: "Finalizada" },
  { id: "NO_CONTINUA", name: "No continúa" },
  { id: "EGRESADA", name: "Egresada" },
]
