import Link from "next/link"

import { TuitionDiscountCategorySheet } from "@/components/admin/tuition-discount-category-sheet"
import { getTuitionDiscountCategories } from "@/lib/admin/discount-categories"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import { getStudentCatalogs } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/server"

export default async function ConfigurationPage() {
  const supabase = await createClient()
  const { catalogs } = await getStudentCatalogs(supabase)
  const cycle = catalogs?.operationalCycle

  if (!cycle) return <ConfigurationError />

  const { data: categories, error } = await getTuitionDiscountCategories(supabase, cycle.id)
  if (error) return <ConfigurationError />

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Configuración</h1>
          <p className="mt-1 text-sm text-muted-foreground">{cycle.name}</p>
        </div>
        <TuitionDiscountCategorySheet cycleId={cycle.id} />
      </header>

      <nav aria-label="Secciones de configuración" className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-5">
          <span className="border-b-2 border-foreground px-1 pb-3 text-sm font-medium">Descuentos de colegiatura</span>
        </div>
      </nav>

      <section className="space-y-3" aria-labelledby="discount-categories">
        <div>
          <h2 id="discount-categories" className="text-base font-semibold">Categorías de descuento</h2>
          <p className="mt-1 text-sm text-muted-foreground">Valores vigentes y programados para el ciclo actual.</p>
        </div>

        {categories.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="divide-y divide-border lg:hidden">
              {categories.map((category) => <CategoryRow key={category.id} category={category} />)}
            </div>
            <table className="hidden w-full text-left text-sm lg:table">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor vigente</th>
                  <th className="px-4 py-3">Fecha efectiva</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="w-16 px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{category.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{discountTypeLabel(category.discountType)}</td>
                    <td className="px-4 py-3 font-medium">{category.currentVersion ? formatValue(category.currentVersion.value, category.discountType) : "Sin valor configurado"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{category.currentVersion ? formatDate(category.currentVersion.validFrom) : "Sin dato"}</td>
                    <td className="px-4 py-3"><Status active={category.isActive} versionStatus={category.versionStatus} /></td>
                    <td className="px-4 py-3"><TuitionDiscountCategorySheet cycleId={cycle.id} category={category} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-y border-border bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium">No hay categorías de descuento.</p>
            <p className="mt-1 text-sm text-muted-foreground">Crea la primera categoría para este ciclo.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function CategoryRow({ category }: { category: TuitionDiscountCategory }) {
  return <div className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{category.name}</p><p className="mt-1 text-xs text-muted-foreground">{discountTypeLabel(category.discountType)} · {category.currentVersion ? formatValue(category.currentVersion.value, category.discountType) : "Sin valor configurado"}</p><p className="mt-1 text-xs text-muted-foreground">{category.currentVersion ? `${category.versionStatus === "SCHEDULED" ? "Programada desde" : "Vigente desde"} ${formatDate(category.currentVersion.validFrom)}` : "Sin versión configurada"} · <Status active={category.isActive} versionStatus={category.versionStatus} /></p></div><TuitionDiscountCategorySheet cycleId={category.cycleId} category={category} /></div>
}

function Status({ active, versionStatus }: { active: boolean; versionStatus?: "CURRENT" | "SCHEDULED" | null }) {
  const versionLabel = versionStatus === "CURRENT" ? "Vigente" : versionStatus === "SCHEDULED" ? "Programada" : "Sin versión"
  return <span className={active ? "text-emerald-700" : "text-muted-foreground"}>{active ? "Activo" : "Inactivo"} · {versionLabel}</span>
}

function discountTypeLabel(type: "PERCENTAGE" | "FIXED_AMOUNT") {
  return type === "PERCENTAGE" ? "Porcentaje" : "Monto fijo"
}

function formatValue(value: number, type: "PERCENTAGE" | "FIXED_AMOUNT") {
  return type === "PERCENTAGE"
    ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)}%`
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function ConfigurationError() {
  return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar la configuración.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/configuracion" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div>
}
