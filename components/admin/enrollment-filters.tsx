"use client"

import { Filter, Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Option = { id: string; name: string }

type EnrollmentFiltersProps = {
  values: Record<string, string | undefined>
  levels: Option[]
  grades: Array<Option & { education_level_id: string }>
  groups: Array<Option & { grade_level_id: string; cycle_id: string }>
  classifications: Option[]
}

export function EnrollmentFilters({ values, levels, grades, groups, classifications }: EnrollmentFiltersProps) {
  const [query, setQuery] = useState(values.query ?? "")
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const normalized = query.trim()
      if ((params.get("query") ?? "") === normalized) return
      if (normalized) params.set("query", normalized)
      else params.delete("query")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [pathname, query, router, searchParams])

  return (
    <div className="space-y-3">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar alumno..."
          aria-label="Buscar alumno"
          className="h-11 bg-white pl-10"
        />
      </div>

      <form action="/admin/matricula" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="cycle" value={values.cycle ?? ""} />
        {values.query && <input type="hidden" name="query" value={values.query} />}
        <FilterSelect label="Nivel" name="level" value={values.level} options={levels} />
        <FilterSelect label="Grado" name="grade" value={values.grade} options={grades} />
        <FilterSelect
          label="Grupo"
          name="group"
          value={values.group}
          options={groups.filter((group) => !values.grade || group.grade_level_id === values.grade)}
        />
        <FilterSelect label="Estado" name="status" value={values.status} options={statuses} />
        <FilterSelect label="Clasificación" name="classification" value={values.classification} options={classifications} />
        <Button type="submit" variant="outline" className="h-10 bg-white"><Filter /> Aplicar</Button>
      </form>
    </div>
  )
}

function FilterSelect({ label, name, value, options }: { label: string; name: string; value?: string; options: Option[] }) {
  return (
    <label className="w-36">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
      >
        <option value="">Todos</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

const statuses = [
  { id: "PREINSCRITA", name: "Preinscrita" },
  { id: "PENDIENTE", name: "Pendiente" },
  { id: "ACTIVA", name: "Activa" },
  { id: "BAJA", name: "Baja" },
  { id: "FINALIZADA", name: "Finalizada" },
  { id: "NO_CONTINUA", name: "No continúa" },
  { id: "EGRESADA", name: "Egresada" },
]
