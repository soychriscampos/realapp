import Link from "next/link"

import { CloseCycleSheet } from "@/components/admin/close-cycle-sheet"
import { SchoolCycleCostSheet } from "@/components/admin/school-cycle-cost-sheet"
import { SchoolCycleGroupSheet } from "@/components/admin/school-cycle-group-sheet"
import { SchoolCycleSheet } from "@/components/admin/school-cycle-sheet"
import { TuitionDiscountCategorySheet } from "@/components/admin/tuition-discount-category-sheet"
import { getActiveEnrollmentCount } from "@/lib/admin/enrollments"
import { getTuitionDiscountCategories } from "@/lib/admin/discount-categories"
import type { TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import { getSchoolCycleDetail, getSchoolCycles } from "@/lib/admin/school-cycles"
import type { SchoolCycle, SchoolCycleDetail, SchoolCycleGrade, SchoolCycleGroup } from "@/lib/admin/school-cycles"
import { getStudentCatalogs } from "@/lib/admin/students"
import { createClient } from "@/lib/supabase/server"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ConfigurationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const section = params.section === "cycles" ? "cycles" : "discounts"
  const cycleId = typeof params.cycle === "string" ? params.cycle : null
  const view = params.view === "costs" || params.view === "groups" ? params.view : "general"
  const supabase = await createClient()
  const cyclesResult = await getSchoolCycles(supabase)

  if (cyclesResult.error) return <ConfigurationError />

  if (section === "cycles") {
    if (cycleId) {
      const detailResult = await getSchoolCycleDetail(supabase, cycleId)
      if (detailResult.error || !detailResult.data) return <ConfigurationError />
      return <CycleDetail detail={detailResult.data} view={view} />
    }
    return <CyclesSection cycles={cyclesResult.data} />
  }

  const { catalogs } = await getStudentCatalogs(supabase)
  const cycle = catalogs?.operationalCycle
  if (!cycle) return <ConfigurationError />
  const { data: categories, error } = await getTuitionDiscountCategories(supabase, cycle.id)
  if (error) return <ConfigurationError />
  return <DiscountsSection cycleName={cycle.name} cycleId={cycle.id} categories={categories} />
}

function ConfigurationHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>{action}</header>
}

function ConfigurationNav({ active, cycleId }: { active: "discounts" | "cycles"; cycleId?: string }) {
  const cyclesHref = cycleId ? `/admin/configuracion?section=cycles&cycle=${cycleId}` : "/admin/configuracion?section=cycles"
  return <nav aria-label="Secciones de configuración" className="overflow-x-auto border-b border-border"><div className="flex min-w-max gap-5"><Link href="/admin/configuracion?section=discounts" className={active === "discounts" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}>Descuentos de colegiatura</Link><Link href={cyclesHref} className={active === "cycles" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}>Ciclos escolares</Link></div></nav>
}

function DiscountsSection({ cycleId, cycleName, categories }: { cycleId: string; cycleName: string; categories: TuitionDiscountCategory[] }) {
  return <div className="space-y-7"><ConfigurationHeader title="Configuración" subtitle={cycleName} action={<TuitionDiscountCategorySheet cycleId={cycleId} />} /><ConfigurationNav active="discounts" /><section className="space-y-3" aria-labelledby="discount-categories"><div><h2 id="discount-categories" className="text-base font-semibold">Categorías de descuento</h2><p className="mt-1 text-sm text-muted-foreground">Valores vigentes y programados para el ciclo actual.</p></div>{categories.length ? <div className="overflow-hidden rounded-xl border border-border bg-white"><div className="divide-y divide-border lg:hidden">{categories.map((category) => <CategoryRow key={category.id} category={category} />)}</div><table className="hidden w-full text-left text-sm lg:table"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Valor vigente</th><th className="px-4 py-3">Fecha efectiva</th><th className="px-4 py-3">Estado</th><th className="w-16 px-4 py-3"><span className="sr-only">Acciones</span></th></tr></thead><tbody className="divide-y divide-border">{categories.map((category) => <tr key={category.id} className="hover:bg-muted/40"><td className="px-4 py-3 font-medium">{category.name}</td><td className="px-4 py-3 text-muted-foreground">{discountTypeLabel(category.discountType)}</td><td className="px-4 py-3 font-medium">{category.currentVersion ? formatValue(category.currentVersion.value, category.discountType) : "Sin valor configurado"}</td><td className="px-4 py-3 text-muted-foreground">{category.currentVersion ? formatDate(category.currentVersion.validFrom) : "Sin dato"}</td><td className="px-4 py-3"><Status active={category.isActive} versionStatus={category.versionStatus} /></td><td className="px-4 py-3"><TuitionDiscountCategorySheet cycleId={cycleId} category={category} /></td></tr>)}</tbody></table></div> : <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No hay categorías de descuento.</p><p className="mt-1 text-sm text-muted-foreground">Crea la primera categoría para este ciclo.</p></div>}</section></div>
}

function CategoryRow({ category }: { category: TuitionDiscountCategory }) {
  return <div className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{category.name}</p><p className="mt-1 text-xs text-muted-foreground">{discountTypeLabel(category.discountType)} · {category.currentVersion ? formatValue(category.currentVersion.value, category.discountType) : "Sin valor configurado"}</p><p className="mt-1 text-xs text-muted-foreground">{category.currentVersion ? `${category.versionStatus === "SCHEDULED" ? "Programada desde" : "Vigente desde"} ${formatDate(category.currentVersion.validFrom)}` : "Sin versión configurada"} · <Status active={category.isActive} versionStatus={category.versionStatus} /></p></div><TuitionDiscountCategorySheet cycleId={category.cycleId} category={category} /></div>
}

function CyclesSection({ cycles }: { cycles: SchoolCycle[] }) {
  return <div className="space-y-7"><ConfigurationHeader title="Configuración" subtitle="Ciclos escolares" action={<SchoolCycleSheet />} /><ConfigurationNav active="cycles" /><section className="space-y-3" aria-labelledby="school-cycles"><div><h2 id="school-cycles" className="text-base font-semibold">Ciclos escolares</h2><p className="mt-1 text-sm text-muted-foreground">Administra los ciclos y su configuración operativa.</p></div>{cycles.length ? <div className="overflow-hidden rounded-xl border border-border bg-white"><div className="divide-y divide-border lg:hidden">{cycles.map((cycle) => <CycleRow key={cycle.id} cycle={cycle} />)}</div><table className="hidden w-full text-left text-sm lg:table"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Fin</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr></thead><tbody className="divide-y divide-border">{cycles.map((cycle) => <tr key={cycle.id} className="hover:bg-muted/40"><td className="px-4 py-3 font-medium">{cycle.code}</td><td className="px-4 py-3">{cycle.name}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(cycle.startsOn)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(cycle.endsOn)}</td><td className="px-4 py-3"><CycleStatus status={cycle.status} /></td><td className="px-4 py-3"><CycleActions cycle={cycle} /></td></tr>)}</tbody></table></div> : <div className="border-y border-border bg-white px-4 py-10 text-center"><p className="text-sm font-medium">No hay ciclos escolares.</p><p className="mt-1 text-sm text-muted-foreground">Crea el primer ciclo para comenzar.</p></div>}</section></div>
}

function CycleRow({ cycle }: { cycle: SchoolCycle }) {
  return <div className="flex items-start gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{cycle.code} · {cycle.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(cycle.startsOn)} — {formatDate(cycle.endsOn)} · <CycleStatus status={cycle.status} /></p></div><CycleActions cycle={cycle} compact /></div>
}

function CycleActions({ cycle, compact = false }: { cycle: SchoolCycle; compact?: boolean }) {
  return <div className={compact ? "flex shrink-0 items-center gap-1" : "flex items-center justify-end gap-2"}><Link href={`/admin/configuracion?section=cycles&cycle=${cycle.id}`} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">{compact ? "Ver" : "Ver configuración"}</Link><SchoolCycleSheet cycle={cycle} />{cycle.status === "ACTIVE" && <CloseCycleAction cycle={cycle} />}</div>
}

async function CloseCycleAction({ cycle }: { cycle: SchoolCycle }) {
  const supabase = await createClient()
  const activeCountResult = await getActiveEnrollmentCount(supabase, cycle.id)
  return <CloseCycleSheet cycle={cycle} activeCount={activeCountResult.count} />
}

function CycleDetail({ detail, view }: { detail: SchoolCycleDetail; view: "general" | "costs" | "groups" }) {
  return <div className="space-y-7"><ConfigurationHeader title={detail.name} subtitle={`${detail.code} · ${cycleStatusLabel(detail.status)}`} /><ConfigurationNav active="cycles" cycleId={detail.id} /><div className="flex flex-wrap items-center gap-4 border-b border-border"><Link href={`/admin/configuracion?section=cycles&cycle=${detail.id}&view=general`} className={view === "general" ? "border-b-2 border-foreground pb-3 text-sm font-medium" : "pb-3 text-sm text-muted-foreground hover:text-foreground"}>General</Link><Link href={`/admin/configuracion?section=cycles&cycle=${detail.id}&view=costs`} className={view === "costs" ? "border-b-2 border-foreground pb-3 text-sm font-medium" : "pb-3 text-sm text-muted-foreground hover:text-foreground"}>Costos</Link><Link href={`/admin/configuracion?section=cycles&cycle=${detail.id}&view=groups`} className={view === "groups" ? "border-b-2 border-foreground pb-3 text-sm font-medium" : "pb-3 text-sm text-muted-foreground hover:text-foreground"}>Grados y grupos</Link></div>{view === "general" ? <GeneralView detail={detail} /> : view === "costs" ? <CostsView detail={detail} /> : <GroupsView detail={detail} />}</div>
}

function GeneralView({ detail }: { detail: SchoolCycleDetail }) {
  return <section className="space-y-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold">Datos generales</h2><p className="mt-1 text-sm text-muted-foreground">Información básica y estado del ciclo escolar.</p></div><div className="flex flex-wrap justify-end gap-2"><SchoolCycleSheet cycle={detail} />{detail.status === "ACTIVE" && <CloseCycleAction cycle={detail} />}</div></div><dl className="divide-y divide-border border-y border-border bg-white"><DetailField label="Código" value={detail.code} /><DetailField label="Nombre" value={detail.name} /><DetailField label="Fecha de inicio" value={formatDate(detail.startsOn)} /><DetailField label="Fecha de fin" value={formatDate(detail.endsOn)} /><DetailField label="Estado" value={cycleStatusLabel(detail.status)} /></dl></section>
}

function CostsView({ detail }: { detail: SchoolCycleDetail }) {
  const today = new Date().toISOString().slice(0, 10)
  return <section className="space-y-3"><div><h2 className="text-base font-semibold">Costos por nivel</h2><p className="mt-1 text-sm text-muted-foreground">Configura colegiatura e inscripción usando el historial de tarifas existente.</p></div><div className="overflow-hidden rounded-xl border border-border bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Nivel</th><th className="px-4 py-3">Colegiatura</th><th className="px-4 py-3">Inscripción</th></tr></thead><tbody className="divide-y divide-border">{detail.levels.map((level) => <tr key={level.id}><td className="px-4 py-3 font-medium">{level.name}</td><td className="px-4 py-3"><RateCell detail={detail} levelId={level.id} conceptCode="TUITION" today={today} /></td><td className="px-4 py-3"><RateCell detail={detail} levelId={level.id} conceptCode="ENROLLMENT_FEE" today={today} /></td></tr>)}</tbody></table></div></section>
}

function RateCell({ detail, levelId, conceptCode, today }: { detail: SchoolCycleDetail; levelId: string; conceptCode: "TUITION" | "ENROLLMENT_FEE"; today: string }) {
  const rates = detail.rates.filter((rate) => rate.educationLevelId === levelId && rate.conceptCode === conceptCode).sort((a, b) => b.validFrom.localeCompare(a.validFrom))
  const currentRates = rates.filter((rate) => rate.validFrom <= today && (!rate.validUntil || rate.validUntil >= today))
  const rate = currentRates[0] ?? rates[0]
  const levelName = detail.levels.find((level) => level.id === levelId)?.name ?? "Nivel educativo"
  return <div className="flex items-center justify-between gap-3"><div><p className="font-medium">{rate ? formatCurrency(rate.amount) : "Sin tarifa"}</p>{rate && <p className="mt-1 text-xs text-muted-foreground">Desde {formatDate(rate.validFrom)}</p>}</div><SchoolCycleCostSheet cycleId={detail.id} levelId={levelId} levelName={levelName} conceptCode={conceptCode} rate={rate ?? null} defaultDate={detail.startsOn} /></div>
}

function GroupsView({ detail }: { detail: SchoolCycleDetail }) {
  return <section className="space-y-5"><div><h2 className="text-base font-semibold">Grados y grupos</h2><p className="mt-1 text-sm text-muted-foreground">Un grado opera en este ciclo cuando tiene al menos un grupo configurado.</p></div><div className="space-y-5">{detail.levels.map((level) => <div key={level.id} className="space-y-2"><h3 className="text-sm font-semibold">{level.name}</h3><div className="space-y-2">{level.grades.map((grade) => <GradeGroups key={grade.id} cycleId={detail.id} grade={grade} />)}</div></div>)}</div></section>
}

function GradeGroups({ cycleId, grade }: { cycleId: string; grade: SchoolCycleGrade }) {
  return <div className="border-y border-border bg-white px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{grade.name}</p><p className="mt-1 text-xs text-muted-foreground">{grade.groups.length ? `${grade.groups.filter((group) => group.isActive).length} grupo(s) activo(s)` : "Sin grupos configurados"}</p></div><SchoolCycleGroupSheet cycleId={cycleId} gradeLevelId={grade.id} gradeName={grade.name} /></div>{grade.groups.length > 0 && <div className="mt-3 divide-y divide-border border-t border-border">{grade.groups.map((group) => <GroupRow key={group.id} group={group} grade={grade} cycleId={cycleId} />)}</div>}</div>
}

function GroupRow({ group, grade, cycleId }: { group: SchoolCycleGroup; grade: SchoolCycleGrade; cycleId: string }) {
  return <div className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{group.code} · {group.name}</p><p className={group.isActive ? "mt-1 text-xs text-emerald-700" : "mt-1 text-xs text-muted-foreground"}>{group.isActive ? "Activo" : "Inactivo"}</p></div><SchoolCycleGroupSheet cycleId={cycleId} gradeLevelId={grade.id} gradeName={grade.name} group={group} /></div>
}

function DetailField({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,12rem)_1fr]"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd></div> }
function CycleStatus({ status }: { status: SchoolCycle["status"] }) { return <span className={status === "ACTIVE" ? "text-emerald-700" : status === "CLOSED" ? "text-muted-foreground" : "text-amber-700"}>{cycleStatusLabel(status)}</span> }
function cycleStatusLabel(status: SchoolCycle["status"]) { return status === "ACTIVE" ? "Activo" : status === "CLOSED" ? "Cerrado" : "Preparación" }
function Status({ active, versionStatus }: { active: boolean; versionStatus?: "CURRENT" | "SCHEDULED" | null }) { const versionLabel = versionStatus === "CURRENT" ? "Vigente" : versionStatus === "SCHEDULED" ? "Programada" : "Sin versión"; return <span className={active ? "text-emerald-700" : "text-muted-foreground"}>{active ? "Activo" : "Inactivo"} · {versionLabel}</span> }
function discountTypeLabel(type: "PERCENTAGE" | "FIXED_AMOUNT") { return type === "PERCENTAGE" ? "Porcentaje" : "Monto fijo" }
function formatValue(value: number, type: "PERCENTAGE" | "FIXED_AMOUNT") { return type === "PERCENTAGE" ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)}%` : formatCurrency(value) }
function formatCurrency(value: number) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value) }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) }
function ConfigurationError() { return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar la configuración.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/configuracion" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div> }
