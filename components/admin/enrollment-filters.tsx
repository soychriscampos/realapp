"use client"

import { Filter, LoaderCircle, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
  applied: boolean
}

export function EnrollmentFilters({ values, situations, levels, grades, groups, classifications, applied }: EnrollmentFiltersProps) {
  const [levelId, setLevelId] = useState(values.level ?? "")
  const [gradeId, setGradeId] = useState(values.grade ?? "")
  const [groupId, setGroupId] = useState(values.group ?? "")
  const [situationId, setSituationId] = useState(values.situation ?? "")
  const [classificationId, setClassificationId] = useState(values.classification ?? "")
  const [query, setQuery] = useState(values.query ?? "")
  const queryEditedRef = useRef(false)
  const [isSearching, setIsSearching] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!queryEditedRef.current) return

    const nextQuery = query.trim()
    const currentQuery = searchParams.get("query") ?? ""
    if (nextQuery === currentQuery) {
      queryEditedRef.current = false
      return
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextQuery) params.set("query", nextQuery)
      else params.delete("query")
      params.set("applied", "1")
      queryEditedRef.current = false
      setIsSearching(true)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [pathname, query, router, searchParams])

  const availableGrades = levelId
    ? grades.filter((grade) => grade.education_level_id === levelId)
    : grades
  const availableGroups = gradeId
    ? groups.filter((group) => group.grade_level_id === gradeId)
    : levelId
      ? groups.filter((group) => availableGrades.some((grade) => grade.id === group.grade_level_id))
      : groups

  return (
    <>
    <form action="/admin/matricula" className="space-y-3" onSubmit={() => setIsSearching(true)}>
      <input type="hidden" name="cycle" value={values.cycle ?? ""} />
      <input type="hidden" name="applied" value="1" />
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="query"
          value={query}
          onChange={(event) => {
            queryEditedRef.current = true
            setQuery(event.target.value)
          }}
          placeholder="Buscar alumno por nombre o apellido..."
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
          disabled={!levelId}
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
          disabled={!gradeId}
          options={availableGroups.map((group) => ({ ...group, name: getEnrollmentGroupLabel(group) }))}
          onChange={setGroupId}
        />
        <FilterSelect label="Matrícula" name="situation" value={situationId} options={situations} emptyLabel="Todas" onChange={setSituationId} />
        <FilterSelect label="Clasificación" name="classification" value={classificationId} options={classifications} onChange={setClassificationId} />
        <Button type="submit" variant="outline" className="h-10 bg-white"><Filter /> Aplicar</Button>
      </div>
    </form>
    {!applied && (
      <p className="flex items-center justify-center gap-2 border-y border-border py-8 text-center text-sm text-muted-foreground">
        {isSearching ? <><LoaderCircle className="size-4 animate-spin" /> Buscando...</> : "Busca o aplica filtros para ver alumnos."}
      </p>
    )}
    </>
  )
}

function FilterSelect({ label, name, value, options, onChange, emptyLabel = "Todos", disabled = false }: { label: string; name: string; value?: string; options: Option[]; onChange?: (value: string) => void; emptyLabel?: string; disabled?: boolean }) {
  return (
    <label className="w-36">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select
        name={name}
        disabled={disabled}
        {...(onChange
          ? { value: value ?? "", onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value) }
          : { defaultValue: value ?? "" })}
        className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}
