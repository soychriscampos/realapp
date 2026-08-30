"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Filter, LoaderCircle, Search, X } from "lucide-react"
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
  const [filtersOpen, setFiltersOpen] = useState(false)
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

      <div className="hidden flex-wrap items-end gap-3 md:flex">
        <FilterFields
          levelId={levelId}
          gradeId={gradeId}
          groupId={groupId}
          situationId={situationId}
          classificationId={classificationId}
          levels={levels}
          availableGrades={availableGrades}
          availableGroups={availableGroups}
          situations={situations}
          classifications={classifications}
          setLevelId={(next) => { setLevelId(next); setGradeId(""); setGroupId("") }}
          setGradeId={(next) => { setGradeId(next); setGroupId("") }}
          setGroupId={setGroupId}
          setSituationId={setSituationId}
          setClassificationId={setClassificationId}
        />
        <Button type="submit" variant="outline" className="h-10 bg-white"><Filter /> Aplicar</Button>
      </div>
    </form>

    <div className="md:hidden">
      <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Dialog.Trigger render={<Button type="button" variant="outline" className="h-10 w-full bg-white"><Filter /> Filtros</Button>} />
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
          <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-white shadow-xl outline-none">
            <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <Dialog.Title className="text-base font-semibold">Filtros</Dialog.Title>
              <Dialog.Close aria-label="Cerrar filtros" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-4" /></Dialog.Close>
            </header>
            <form action="/admin/matricula" className="min-h-0 flex-1 overflow-y-auto" onSubmit={() => { setIsSearching(true); setFiltersOpen(false) }}>
              <input type="hidden" name="cycle" value={values.cycle ?? ""} />
              <input type="hidden" name="query" value={query} />
              <input type="hidden" name="applied" value="1" />
              <div className="grid gap-4 px-4 py-5">
                <FilterFields
                  levelId={levelId}
                  gradeId={gradeId}
                  groupId={groupId}
                  situationId={situationId}
                  classificationId={classificationId}
                  levels={levels}
                  availableGrades={availableGrades}
                  availableGroups={availableGroups}
                  situations={situations}
                  classifications={classifications}
                  setLevelId={(next) => { setLevelId(next); setGradeId(""); setGroupId("") }}
                  setGradeId={(next) => { setGradeId(next); setGroupId("") }}
                  setGroupId={setGroupId}
                  setSituationId={setSituationId}
                  setClassificationId={setClassificationId}
                />
              </div>
              <footer className="sticky bottom-0 border-t border-border bg-white px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
                <Button type="submit" className="h-11 w-full">Aplicar filtros</Button>
              </footer>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
    {!applied && (
      <p className="flex items-center justify-center gap-2 border-y border-border py-8 text-center text-sm text-muted-foreground">
        {isSearching ? <><LoaderCircle className="size-4 animate-spin" /> Buscando...</> : "Busca o aplica filtros para ver alumnos."}
      </p>
    )}
    </>
  )
}

type FilterFieldsProps = {
  levelId: string
  gradeId: string
  groupId: string
  situationId: string
  classificationId: string
  levels: Option[]
  availableGrades: Array<Option & { education_level_id: string }>
  availableGroups: Array<Option & { code: string; grade_level_id: string; cycle_id: string }>
  situations: Option[]
  classifications: Option[]
  setLevelId: (value: string) => void
  setGradeId: (value: string) => void
  setGroupId: (value: string) => void
  setSituationId: (value: string) => void
  setClassificationId: (value: string) => void
}

function FilterFields({ levelId, gradeId, groupId, situationId, classificationId, levels, availableGrades, availableGroups, situations, classifications, setLevelId, setGradeId, setGroupId, setSituationId, setClassificationId }: FilterFieldsProps) {
  return (
    <>
      <FilterSelect label="Nivel" name="level" value={levelId} options={levels} onChange={setLevelId} />
      <FilterSelect
        label="Grado"
        name="grade"
        value={gradeId}
        disabled={!levelId}
        options={availableGrades.map((grade) => ({
          ...grade,
          name: levelId ? grade.name : `${levels.find((level) => level.id === grade.education_level_id)?.name ?? "Nivel"} · ${grade.name}`,
        }))}
        onChange={setGradeId}
      />
      <FilterSelect label="Grupo" name="group" value={groupId} disabled={!gradeId} options={availableGroups.map((group) => ({ ...group, name: getEnrollmentGroupLabel(group) }))} onChange={setGroupId} />
      <FilterSelect label="Matrícula" name="situation" value={situationId} options={situations} emptyLabel="Todas" onChange={setSituationId} />
      <FilterSelect label="Clasificación" name="classification" value={classificationId} options={classifications} onChange={setClassificationId} />
    </>
  )
}

function FilterSelect({ label, name, value, options, onChange, emptyLabel = "Todos", disabled = false }: { label: string; name: string; value?: string; options: Option[]; onChange?: (value: string) => void; emptyLabel?: string; disabled?: boolean }) {
  return (
    <label className="w-full md:w-36">
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
