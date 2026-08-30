import Link from "next/link"

import { EnrollmentFilters } from "@/components/admin/enrollment-filters"
import { EnrollmentCycleSelect } from "@/components/admin/enrollment-cycle-select"
import { EnrollmentList } from "@/components/admin/enrollment-list"
import { PendingEnrollmentCandidatesList } from "@/components/admin/pending-enrollment-candidates-list"
import { BulkEnrollmentActivationSheet } from "@/components/admin/bulk-enrollment-activation-sheet"
import { BulkNoContinuaSheet } from "@/components/admin/bulk-no-continua-sheet"
import { BulkTuitionDiscountSheet } from "@/components/admin/bulk-tuition-discount-sheet"
import { CloseCycleSheet } from "@/components/admin/close-cycle-sheet"
import { FinalizeCycleSheet } from "@/components/admin/finalize-cycle-sheet"
import { NewEnrollmentSheet } from "@/components/admin/new-enrollment-sheet"
import { PreregistrationCampaignSheet } from "@/components/admin/preregistration-campaign-sheet"
import { PreregistrationEnrollmentSheet } from "@/components/admin/preregistration-enrollment-sheet"
import { PreregistrationIntakeSheet } from "@/components/admin/preregistration-intake-sheet"
import { StudentModuleNav } from "@/components/admin/student-module-nav"
import { getBulkEnrollmentCandidates, getNoContinuaCandidates, type BulkEnrollmentCandidate, type NoContinuaCandidate } from "@/lib/admin/bulk-enrollment"
import { getBulkTuitionDiscountCandidates } from "@/lib/admin/bulk-tuition-discounts"
import { getTuitionDiscountCategories } from "@/lib/admin/discount-categories"
import { getActiveEnrollmentCount, getEnrollmentFinancialCoverage, getEnrollments, type EnrollmentListItem } from "@/lib/admin/enrollments"
import { getConvertiblePreregistrations } from "@/lib/admin/preregistrations"
import { getPreregistrationCampaigns } from "@/lib/admin/preregistration-campaigns"
import { getPaymentFormContext } from "@/lib/admin/payments"
import { getStudentCatalogs } from "@/lib/admin/students"
import { requireRole } from "@/lib/auth/require-role"

type EnrollmentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EnrollmentPage({ searchParams }: EnrollmentPageProps) {
  const params = await searchParams
  const { supabase, userId, roles } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError || !catalogs) return <EnrollmentLoadError />

  const applied = value(params.applied) === "1"
  const values = {
    cycle: value(params.cycle) ?? catalogs.operationalCycle?.id ?? catalogs.cycles[0]?.id,
    query: value(params.query),
    level: value(params.level),
    grade: value(params.grade),
    group: value(params.group),
    situation: value(params.situation) ?? "",
    classification: value(params.classification),
    tab: value(params.tab) === "preinscripciones" ? "preinscripciones" : "matricula",
  }

  if (!values.cycle) return <EnrollmentLoadError />

  const selectedCycle = catalogs.cycles.find((cycle) => cycle.id === values.cycle)
  const operationalCycle = catalogs.operationalCycle
  const isCurrentCycle = selectedCycle?.id === operationalCycle?.id
  const supportsContinuity = isCurrentCycle && (selectedCycle?.status === "ACTIVE" || selectedCycle?.status === "PREPARATION")
  const isActiveOperationalCycle = isCurrentCycle && selectedCycle?.status === "ACTIVE"
  const situationOptions = situationsForCycle(selectedCycle?.status, supportsContinuity)
  const situation = values.situation && situationOptions.some((option) => option.id === values.situation)
    ? values.situation
    : ""
  values.situation = situation
  const statuses = enrollmentStatusesForSituation(situation, selectedCycle?.status)
  const previousCycle = supportsContinuity
    ? catalogs.cycles
      .filter((cycle) => cycle.starts_on < selectedCycle.starts_on)
      .sort((left, right) => right.starts_on.localeCompare(left.starts_on))[0]
    : undefined

  const [groupsResult, enrollmentResult, activeCountResult, financialCoverageResult, discountCategoriesResult, paymentContextResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, code, cycle_id, grade_level_id")
      .eq("is_active", true)
      .order("name"),
    applied && statuses.length
      ? getEnrollments(supabase, {
        cycleId: values.cycle,
        query: values.query,
        educationLevelId: values.level,
        gradeLevelId: values.grade,
        groupId: values.group,
        classificationId: values.classification,
        status: statuses,
      })
      : Promise.resolve({ data: [] as EnrollmentListItem[], error: false }),
    getActiveEnrollmentCount(supabase, values.cycle),
    getEnrollmentFinancialCoverage(supabase),
    getTuitionDiscountCategories(supabase, values.cycle),
    getPaymentFormContext(supabase, userId),
  ])

  if (groupsResult.error || enrollmentResult.error || activeCountResult.error || financialCoverageResult.error || discountCategoriesResult.error) {
    return <EnrollmentLoadError />
  }

  const [bulkCandidatesResult, noContinuaCandidatesResult] = applied && supportsContinuity && previousCycle
    ? await Promise.all([
      getBulkEnrollmentCandidates(supabase, previousCycle.id, selectedCycle.id),
      getNoContinuaCandidates(supabase, previousCycle.id, selectedCycle.id, catalogs.grades, catalogs.levels),
    ])
    : [{ data: [], error: false }, { data: [], error: false }] as [{ data: BulkEnrollmentCandidate[]; error: boolean }, { data: NoContinuaCandidate[]; error: boolean }]
  const bulkDiscountCandidatesResult = isActiveOperationalCycle
    ? await getBulkTuitionDiscountCandidates(supabase, selectedCycle.id)
    : { data: [], error: false }
  const [preregistrationsResult, preregistrationCampaignsResult] = await Promise.all([
    getConvertiblePreregistrations(supabase),
    getPreregistrationCampaigns(supabase),
  ])

  return (
    <div className="space-y-6">
      <StudentModuleNav />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Matrícula</h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedCycle?.name ?? "Ciclo escolar"}</p>
        </div>
        {values.tab === "matricula" && <div className="flex flex-wrap gap-2">
          {selectedCycle?.status === "ACTIVE" && <>
            <FinalizeCycleSheet cycle={selectedCycle} activeCount={activeCountResult.count} />
            <CloseCycleSheet cycle={selectedCycle} activeCount={activeCountResult.count} />
          </>}
          <NewEnrollmentSheet
            cycles={catalogs.cycles}
            operationalCycleId={catalogs.operationalCycle?.id}
            levels={catalogs.levels}
            grades={catalogs.grades}
            groups={groupsResult.data ?? []}
            classifications={catalogs.classifications}
            financialCoverage={financialCoverageResult.data}
            discountCategories={discountCategoriesResult.data}
          />
        </div>}
      </header>

      <EnrollmentCycleSelect cycles={catalogs.cycles} value={values.cycle} />

      <nav aria-label="Vistas de matrícula" className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-5">
          <Tab href={tabHref(values, "matricula")} active={values.tab === "matricula"}>Matrícula</Tab>
          <Tab href={tabHref(values, "preinscripciones")} active={values.tab === "preinscripciones"}>Preinscripciones</Tab>
        </div>
      </nav>

      {values.tab === "preinscripciones" && (
        <div className="flex flex-wrap gap-2">
          <PreregistrationIntakeSheet
            campaigns={preregistrationCampaignsResult.data}
            cycles={catalogs.cycles}
            levels={catalogs.levels}
            grades={catalogs.grades}
            groups={groupsResult.data ?? []}
            operationalCycleId={catalogs.operationalCycle?.id}
            paymentContext={paymentContextResult.data}
            canReceiveForOthers={roles.includes("MASTER")}
          />
          <PreregistrationCampaignSheet
            campaigns={preregistrationCampaignsResult.data}
            loadError={preregistrationCampaignsResult.error}
            cycles={catalogs.cycles}
            levels={catalogs.levels}
            operationalCycleId={catalogs.operationalCycle?.id}
          />
          <PreregistrationEnrollmentSheet
            preregistrations={preregistrationsResult.data}
            loadError={preregistrationsResult.error}
            cycles={catalogs.cycles}
            levels={catalogs.levels}
            grades={catalogs.grades}
            groups={groupsResult.data ?? []}
            classifications={catalogs.classifications}
            financialCoverage={financialCoverageResult.data}
            discountCategories={discountCategoriesResult.data}
          />
        </div>
      )}

      {values.tab === "matricula" && situation === "pending" && supportsContinuity && previousCycle && (
        <div className="flex flex-wrap gap-2">
          <BulkEnrollmentActivationSheet
            cycle={selectedCycle}
            previousCycleName={previousCycle.name}
            candidates={bulkCandidatesResult.data}
            loadError={bulkCandidatesResult.error}
            levels={catalogs.levels}
            grades={catalogs.grades}
            groups={groupsResult.data ?? []}
            classifications={catalogs.classifications}
            financialCoverage={financialCoverageResult.data}
            discountCategories={discountCategoriesResult.data}
          />
          <BulkNoContinuaSheet
            cycle={selectedCycle}
            previousCycleName={previousCycle.name}
            candidates={noContinuaCandidatesResult.data}
            loadError={noContinuaCandidatesResult.error}
          />
        </div>
      )}

      {values.tab === "matricula" && isActiveOperationalCycle && (
        <div className="flex flex-wrap gap-2">
          <BulkTuitionDiscountSheet
            cycle={selectedCycle}
            candidates={bulkDiscountCandidatesResult.data}
            loadError={bulkDiscountCandidatesResult.error}
            categories={discountCategoriesResult.data.filter((category) => category.isActive)}
          />
        </div>
      )}

      {values.tab === "matricula" && <>
        <EnrollmentFilters
          key={`${values.cycle}-${values.situation}-${values.level ?? ""}-${values.grade ?? ""}-${values.group ?? ""}`}
          values={values}
          situations={situationOptions}
          levels={catalogs.levels}
          grades={catalogs.grades}
          groups={(groupsResult.data ?? []).filter((group) => group.cycle_id === values.cycle)}
          classifications={catalogs.classifications}
          applied={applied}
        />

        {applied ? (
          <EnrollmentSituationResults
            situation={situation}
            enrollments={enrollmentResult.data}
            pendingCandidates={includesPendingCandidates(situation, supportsContinuity)
              ? filterPendingCandidates(bulkCandidatesResult.data, values)
              : []}
            pendingLoadError={bulkCandidatesResult.error}
          />
        ) : null}
      </>}
    </div>
  )
}

type SituationOption = { id: string; name: string }

function situationsForCycle(cycleStatus: string | undefined, supportsContinuity: boolean): SituationOption[] {
  if (supportsContinuity) {
    return [
      { id: "active", name: "Activa" },
      { id: "pending", name: "Pendiente" },
      { id: "withdrawn", name: "Baja" },
    ]
  }

  if (cycleStatus === "CLOSED") {
    return [
      { id: "active", name: "Activa" },
      { id: "finalized", name: "Finalizada" },
      { id: "withdrawn", name: "Baja" },
      { id: "graduated", name: "Egresada" },
    ]
  }

  return [
    { id: "active", name: "Activa" },
    { id: "withdrawn", name: "Baja" },
  ]
}

function enrollmentStatusesForSituation(situation: string, cycleStatus: string | undefined) {
  if (situation === "pending") return []
  if (situation === "active") return ["ACTIVA"]
  if (situation === "finalized") return ["FINALIZADA"]
  if (situation === "graduated") return ["EGRESADA"]
  if (situation === "withdrawn") return ["BAJA", "NO_CONTINUA"]

  return cycleStatus === "CLOSED"
    ? ["FINALIZADA", "BAJA", "NO_CONTINUA", "EGRESADA"]
    : ["ACTIVA", "BAJA", "NO_CONTINUA"]
}

function includesPendingCandidates(situation: string, supportsContinuity: boolean) {
  return supportsContinuity && (!situation || situation === "pending")
}

function filterPendingCandidates(candidates: BulkEnrollmentCandidate[], values: Record<string, string | undefined>) {
  const query = normalizeSearch(values.query ?? "")

  return candidates.filter((candidate) => {
    if (query && !normalizeSearch(`${candidate.fullName} ${candidate.studentCode ?? ""}`).includes(query)) return false
    if (values.level && candidate.previousGrade.educationLevelId !== values.level) return false
    if (values.grade && candidate.previousGrade.id !== values.grade) return false
    if (values.classification && candidate.previousClassificationId !== values.classification) return false
    return true
  })
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim()
}

function EnrollmentSituationResults({
  situation,
  enrollments,
  pendingCandidates,
  pendingLoadError,
}: {
  situation: string
  enrollments: EnrollmentListItem[]
  pendingCandidates: BulkEnrollmentCandidate[]
  pendingLoadError: boolean
}) {
  const total = enrollments.length + pendingCandidates.length
  const pendingOnly = situation === "pending"

  return (
    <section aria-label="Matrículas del ciclo" className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {pendingOnly
          ? `${pendingCandidates.length} pendiente${pendingCandidates.length === 1 ? "" : "s"} de continuidad`
          : `${total} resultado${total === 1 ? "" : "s"}`}
      </p>

      {pendingLoadError && pendingOnly ? (
        <div className="border-y border-border bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium">No pudimos cargar los alumnos pendientes de continuidad.</p>
          <p className="mt-1 text-sm text-muted-foreground">Actualiza la página e inténtalo de nuevo.</p>
        </div>
      ) : (
        <>
          {!pendingOnly && enrollments.length > 0 && <EnrollmentList enrollments={enrollments} />}
          {pendingCandidates.length > 0 && (
            <div className="space-y-3">
              {!pendingOnly && <h2 className="text-sm font-medium">Pendientes de continuidad</h2>}
              <PendingEnrollmentCandidatesList candidates={pendingCandidates} />
            </div>
          )}
          {!enrollments.length && !pendingCandidates.length && !pendingLoadError && (
            pendingOnly
              ? <PendingEnrollmentCandidatesList candidates={[]} />
              : <EnrollmentList enrollments={[]} />
          )}
        </>
      )}
    </section>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={active ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}>{children}</Link>
}

function value(param: string | string[] | undefined) {
  return typeof param === "string" ? param : undefined
}

function tabHref(values: Record<string, string | undefined>, tab: string) {
  const params = new URLSearchParams()
  if (values.cycle) params.set("cycle", values.cycle)
  if (tab === "preinscripciones") params.set("tab", tab)
  return `/admin/matricula?${params.toString()}`
}

function EnrollmentLoadError() {
  return <div className="max-w-lg border-y border-border bg-white px-4 py-10"><h1 className="text-lg font-semibold">No pudimos cargar las matrículas.</h1><p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Link href="/admin/matricula" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">Intentar de nuevo</Link></div>
}
