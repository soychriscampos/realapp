"use client"

import { Filter, Search } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getEnrollmentGroupLabel } from "@/lib/admin/enrollments"

type Option = { id: string; name: string }

type EnrollmentFiltersProps = {
  values: Record<string, string | undefined>
  situations: Option[]
  levels: Option[]
  grades: Array<Option & { education_level_id: string }>
  groups: Array<Option & { code: string; grade_level_id: string; cycle_id: string }>
  classifications: Option[]
}

export function EnrollmentFilters({ values, situations, levels, grades, groups, classifications }: EnrollmentFiltersProps) {
  const [levelId, setLevelId] = useState(values.level ?? "")
  const [gradeId, setGradeId] = useState(values.grade ?? "")
  const [groupId, setGroupId] = useState(values.group ?? "")

  const availableGrades = levelId
    ? grades.filter((grade) => grade.education_level_id === levelId)
    : grades
  const availableGroups = gradeId
    ? groups.filter((group) => group.grade_level_id === gradeId)
    : levelId
      ? groups.filter((group) => availableGrades.some((grade) => grade.id === group.grade_level_id))
      : groups

  return (
    <form action="/admin/matricula" className="space-y-3">
      <input type="hidden" name="cycle" value={values.cycle ?? ""} />
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="query"
          defaultValue={values.query ?? ""}
          placeholder="Buscar dentro de resultados..."
          aria-label="Buscar dentro de resultados"
          className="h-11 bg-white pl-10"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Nivel"
          name="level"
          value={levelId}
          options={levels}
          onChange={(nextLevelId) => {
            setLevelId(nextLevelId)
            setGradeId("")
            setGroupId("")
          }}
        />
        <FilterSelect
          label="Grado"
          name="grade"
          value={gradeId}
          options={availableGrades.map((grade) => ({
            ...grade,
            name: levelId ? grade.name : `${levels.find((level) => level.id === grade.education_level_id)?.name ?? "Nivel"} · ${grade.name}`,
          }))}
          onChange={(nextGradeId) => {
            setGradeId(nextGradeId)
            setGroupId("")
          }}
        />
        <FilterSelect
          label="Grupo"
          name="group"
          value={groupId}
          options={availableGroups.map((group) => ({ ...group, name: getEnrollmentGroupLabel(group) }))}
          onChange={setGroupId}
        />
        <FilterSelect label="Matrícula" name="situation" value={values.situation} options={situations} emptyLabel="Todas" />
        <FilterSelect label="Clasificación" name="classification" value={values.classification} options={classifications} />
        <Button type="submit" variant="outline" className="h-10 bg-white"><Filter /> Aplicar</Button>
      </div>
    </form>
  )
}

function FilterSelect({ label, name, value, options, onChange, emptyLabel = "Todos" }: { label: string; name: string; value?: string; options: Option[]; onChange?: (value: string) => void; emptyLabel?: string }) {
  return (
    <label className="w-36">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select
        name={name}
        {...(onChange
          ? { value: value ?? "", onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value) }
          : { defaultValue: value ?? "" })}
        className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}
