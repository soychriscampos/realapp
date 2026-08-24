import Link from "next/link"

import { EnrollmentFilters } from "@/components/admin/enrollment-filters"
import { EnrollmentList } from "@/components/admin/enrollment-list"
import { BulkEnrollmentActivationSheet } from "@/components/admin/bulk-enrollment-activation-sheet"
import { NewEnrollmentSheet } from "@/components/admin/new-enrollment-sheet"
import { getBulkEnrollmentCandidates } from "@/lib/admin/bulk-enrollment"
import { getTuitionDiscountCategories } from "@/lib/admin/discount-categories"
import { getEnrollmentFinancialCoverage, getEnrollments, getTenPaymentPlans } from "@/lib/admin/enrollments"
import { getStudentCatalogs } from "@/lib/admin/students"
import { requireRole } from "@/lib/auth/require-role"

type EnrollmentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EnrollmentPage({ searchParams }: EnrollmentPageProps) {
  const params = await searchParams
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError || !catalogs) return <EnrollmentLoadError />

  const values = {
    cycle: value(params.cycle) ?? catalogs.operationalCycle?.id ?? catalogs.cycles[0]?.id,
    query: value(params.query),
    level: value(params.level),
    grade: value(params.grade),
    group: value(params.group),
    status: value(params.status),
    classification: value(params.classification),
    tab: value(params.tab) ?? "actual",
  }

  if (!values.cycle) return <EnrollmentLoadError />

  const [groupsResult, enrollmentResult, financialCoverageResult, tenPaymentPlansResult, discountCategoriesResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, code, cycle_id, grade_level_id")
      .eq("is_active", true)
      .order("name"),
    getEnrollments(supabase, {
      cycleId: values.cycle,
      query: values.query,
      educationLevelId: values.level,
      gradeLevelId: values.grade,
      groupId: values.group,
      classificationId: values.classification,
      status: tabStatus(values.tab, values.status),
    }),
    getEnrollmentFinancialCoverage(supabase),
    getTenPaymentPlans(supabase),
    getTuitionDiscountCategories(supabase, values.cycle),
  ])

  if (groupsResult.error || enrollmentResult.error || financialCoverageResult.error || tenPaymentPlansResult.error || discountCategoriesResult.error) {
    return <EnrollmentLoadError />
  }

  const selectedCycle = catalogs.cycles.find((cycle) => cycle.id === values.cycle)
  const operationalCycle = catalogs.operationalCycle
  const previousCycle = operationalCycle
    ? catalogs.cycles
        .filter((cycle) => cycle.starts_on < operationalCycle.starts_on)
        .sort((left, right) => right.starts_on.localeCompare(left.starts_on))[0]
    : undefined
  const bulkCandidatesResult = operationalCycle && values.cycle === operationalCycle.id && previousCycle
    ? await getBulkEnrollmentCandidates(supabase, previousCycle.id, operationalCycle.id)
    : { data: [], error: false }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Matrícula</h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedCycle?.name ?? "Ciclo escolar"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {operationalCycle && values.cycle === operationalCycle.id && previousCycle && (
            <BulkEnrollmentActivationSheet
              cycle={operationalCycle}
              previousCycleName={previousCycle.name}
              candidates={bulkCandidatesResult.data}
              loadError={bulkCandidatesResult.error}
              levels={catalogs.levels}
              grades={catalogs.grades}
              groups={groupsResult.data ?? []}
              classifications={catalogs.classifications}
              financialCoverage={financialCoverageResult.data}
            />
          )}
          <NewEnrollmentSheet
            cycles={catalogs.cycles}
            operationalCycleId={catalogs.operationalCycle?.id}
            levels={catalogs.levels}
            grades={catalogs.grades}
            groups={groupsResult.data ?? []}
            classifications={catalogs.classifications}
            financialCoverage={financialCoverageResult.data}
          />
        </div>
      </header>

      <form action="/admin/matricula" className="flex items-end gap-3">
        {values.tab !== "actual" && <input type="hidden" name="tab" value={values.tab} />}
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Ciclo</span>
          <select
            name="cycle"
            defaultValue={values.cycle}
            className="h-10 min-w-52 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
          >
            {catalogs.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
          </select>
        </label>
        <button className="h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Cambiar</button>
      </form>

      <nav aria-label="Vistas de matrícula" className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-5">
          <Tab href={tabHref(values, "actual")} active={values.tab === "actual"}>Actual</Tab>
          <Tab href={tabHref(values, "preinscritas")} active={values.tab === "preinscritas"}>Preinscripciones</Tab>
          <Tab href={tabHref(values, "pendientes")} active={values.tab === "pendientes"}>Pendientes</Tab>
          <Tab href={tabHref(values, "no-continua")} active={values.tab === "no-continua"}>No continúa</Tab>
        </div>
      </nav>

      <EnrollmentFilters
        values={values}
        levels={catalogs.levels}
        grades={catalogs.grades}
        groups={(groupsResult.data ?? []).filter((group) => group.cycle_id === values.cycle)}
        classifications={catalogs.classifications}
      />

      <section aria-label="Matrículas del ciclo" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {enrollmentResult.data.length === 100
            ? "Mostrando las primeras 100 matrículas. Refina la búsqueda para ver menos resultados."
            : `${enrollmentResult.data.length} matrícula${enrollmentResult.data.length === 1 ? "" : "s"}`}
        </p>
        <EnrollmentList
          enrollments={enrollmentResult.data}
          groups={groupsResult.data ?? []}
          classifications={catalogs.classifications}
          tenPaymentPlans={tenPaymentPlansResult.data}
          financialCoverage={financialCoverageResult.data}
          discountCategories={discountCategoriesResult.data.filter((category) => category.isActive)}
        />
      </section>
    </div>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={active ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}>{children}</Link>
}

function value(param: string | string[] | undefined) {
  return typeof param === "string" ? param : undefined
}

function tabStatus(tab: string, status?: string) {
  if (status) return status
  return {
    preinscritas: "PREINSCRITA",
    pendientes: "PENDIENTE",
    "no-continua": "NO_CONTINUA",
  }[tab]
}

function tabHref(values: Record<string, string | undefined>, tab: string) {
  const params = new URLSearchParams()
  if (values.cycle) params.set("cycle", values.cycle)
  if (tab !== "actual") params.set("tab", tab)
  return `/admin/matricula?${params.toString()}`
}

function EnrollmentLoadError() {
  return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar las matrículas.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/matricula" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div>
}
