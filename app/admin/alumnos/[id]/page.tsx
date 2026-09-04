import { ChevronLeft, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EnrollmentActions } from "@/components/admin/enrollment-actions"
import { EnrollmentCycleSelect } from "@/components/admin/enrollment-cycle-select"
import { AddGuardianSheet, EditGuardianSheet } from "@/components/admin/edit-guardian-sheet"
import { FamilyAccessSheet } from "@/components/admin/family-access-sheet"
import { UnlinkGuardianDialog } from "@/components/admin/unlink-guardian-dialog"
import { EditStudentBasicsSheet } from "@/components/admin/edit-student-basics-sheet"
import { AccountSummary } from "@/components/admin/student-account"
import { RegisterPaymentSheet } from "@/components/admin/register-payment-sheet"
import { EditEnrollmentFeeSheet } from "@/components/admin/edit-enrollment-fee-sheet"
import { StudentAccountView } from "@/components/admin/student-account-view"
import {
  getStudentAccount,
  getStudentAccountSummary,
  getStudentChargeBalances,
  getStudentPaymentDetails,
} from "@/lib/admin/student-account"
import { getTuitionDiscountCategories } from "@/lib/admin/discount-categories"
import {
  formatEnrollmentStatus,
  getEnrollmentFinancialCoverage,
  getEnrollmentGroupLabel,
  getEnrollments,
  getTenPaymentPlans,
  type EnrollmentListItem,
} from "@/lib/admin/enrollments"
import { getPaymentFormContext } from "@/lib/admin/payments"
import { getStudentEmailRecipients } from "@/lib/email/recipients"
import { getStudentCatalogs, getStudentDetail } from "@/lib/admin/students"
import { requireRole } from "@/lib/auth/require-role"

type StudentDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StudentDetailPage({ params, searchParams }: StudentDetailPageProps) {
  const { id } = await params
  const query = await searchParams
  const returnTo = validReturnTo(query.returnTo)
  const activeTab = query.tab === "account" || query.tab === "enrollment" || query.tab === "academic" || query.tab === "family" ? query.tab : "summary"
  const { roles, supabase, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError) return <StudentDetailLoadError />

  const operationalCycleId = catalogs?.operationalCycle?.id

  const [
    { data: student, error },
    accountSummaryResult,
    chargeBalancesResult,
    paymentContextResult,
    enrollmentResult,
    accountResult,
    emailRecipientsResult,
  ] = await Promise.all([
    getStudentDetail(supabase, id, operationalCycleId),
    getStudentAccountSummary(supabase, id),
    getStudentChargeBalances(supabase, id),
    getPaymentFormContext(supabase, userId),
    operationalCycleId
      ? getEnrollments(supabase, { cycleId: operationalCycleId, studentId: id })
      : Promise.resolve({ data: [], error: false }),
    activeTab === "account"
      ? getStudentAccount(supabase, id)
      : Promise.resolve({ data: null, error: false }),
    getStudentEmailRecipients(supabase, id),
  ])

  if (error) return <StudentDetailLoadError />
  if (!student) notFound()

  const accountPaymentIds = accountResult.data?.movements
    .filter((movement) => movement.movementType === "PAYMENT")
    .map((movement) => movement.id) ?? []
  const accountPaymentsResult = activeTab === "account" && accountResult.data
    ? await getStudentPaymentDetails(supabase, student.id, accountPaymentIds)
    : { data: [], error: false }

  const historicalEnrollmentResults = activeTab === "enrollment"
    ? await Promise.all((catalogs?.cycles ?? []).map((cycle) => getEnrollments(supabase, { cycleId: cycle.id, studentId: id })))
    : []
  const historicalEnrollments = historicalEnrollmentResults.flatMap((result) => result.data)
  const currentEnrollment = enrollmentResult.data[0] ?? null
  const requestedCycleId = typeof query.cycle === "string" ? query.cycle : undefined
  const selectedEnrollment = activeTab === "enrollment"
    ? historicalEnrollments.find((item) => item.cycleId === requestedCycleId)
      ?? currentEnrollment
      ?? [...historicalEnrollments].sort((left, right) => right.enrolledOn.localeCompare(left.enrolledOn))[0]
      ?? null
    : currentEnrollment
  const actionEnrollment = selectedEnrollment
  const enrollment = currentEnrollment ?? student.enrollment
  const actionCycleId = actionEnrollment?.cycleId ?? operationalCycleId
  const enrollmentFeeChargeResult = actionEnrollment
    ? await supabase
      .from("charges")
      .select("id, original_amount, financial_concepts!inner(code), charge_adjustments(amount)")
      .eq("enrollment_id", actionEnrollment.id)
      .eq("financial_concepts.code", "ENROLLMENT_FEE")
      .eq("status", "ACTIVE")
      .limit(1)
    : { data: [], error: null }
  const enrollmentFeeCharge = enrollmentFeeChargeResult.data?.[0]
  const enrollmentFeeAmount = enrollmentFeeCharge
    ? Number(enrollmentFeeCharge.original_amount) + ((enrollmentFeeCharge.charge_adjustments as Array<{ amount: number | string }> | null) ?? []).reduce((sum, adjustment) => sum + Number(adjustment.amount), 0)
    : null
  const [actionPlansResult, actionFinancialCoverageResult, actionDiscountCategoriesResult, actionGroupsResult] = await Promise.all([
    actionCycleId ? getTenPaymentPlans(supabase) : Promise.resolve({ data: [], error: false }),
    actionCycleId ? getEnrollmentFinancialCoverage(supabase) : Promise.resolve({ data: [], error: false }),
    actionCycleId ? getTuitionDiscountCategories(supabase, actionCycleId) : Promise.resolve({ data: [], error: false }),
    actionCycleId
      ? supabase.from("groups").select("id, name, code, cycle_id, grade_level_id").eq("cycle_id", actionCycleId).eq("is_active", true).order("name")
      : Promise.resolve({ data: [], error: null }),
  ])
  const schoolActionsAvailable = Boolean(
    actionEnrollment && !actionGroupsResult.error
  )
  const financialActionsAvailable = Boolean(
    actionEnrollment &&
      !actionPlansResult.error &&
      !actionFinancialCoverageResult.error &&
      !actionDiscountCategoriesResult.error
  )
  const studentContext = enrollment
      ? `${enrollment.educationLevel.name} · ${enrollment.gradeLevel.name}${enrollment.group ? ` ${getEnrollmentGroupLabel(enrollment.group)}` : ""}`
    : "Sin matrícula en el ciclo operativo"

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link
          href={returnTo}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" />
          Alumnos
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">
              {student.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">{studentContext}</p>
            {enrollment && (
              <p className="text-sm font-medium">
                {formatEnrollmentStatus(enrollment.status)}
              </p>
            )}
          </div>
          <RegisterPaymentSheet
            student={{ id: student.id, fullName: student.fullName, context: studentContext }}
            charges={chargeBalancesResult.data}
            methods={paymentContextResult.data?.methods ?? []}
            receivers={paymentContextResult.data?.receivers ?? []}
            currentReceiverId={paymentContextResult.data?.currentReceiverId ?? null}
            canReceiveForOthers={roles.includes("MASTER")}
            hasEmailRecipients={!emailRecipientsResult.error && emailRecipientsResult.data.length > 0}
            disabledReason={paymentUnavailableReason(
              chargeBalancesResult.error,
              paymentContextResult.error,
              paymentContextResult.data?.currentReceiverId,
              paymentContextResult.data?.receivers.length ?? 0,
              roles.includes("MASTER")
            )}
            triggerClassName="w-full sm:w-auto"
          />
        </div>
      </header>

      <nav aria-label="Secciones del alumno" className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-5">
          <Link
            href={studentTabHref(id, returnTo, "summary")}
            className={activeTab === "summary" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}
          >
            Resumen
          </Link>
          <Link
            href={studentTabHref(id, returnTo, "account")}
            className={activeTab === "account" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}
          >
            Cuenta
          </Link>
          <Link
            href={studentTabHref(id, returnTo, "enrollment")}
            className={activeTab === "enrollment" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}
          >
            Matrícula
          </Link>
          <Link
            href={studentTabHref(id, returnTo, "academic")}
            className={activeTab === "academic" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}
          >
            Académico
          </Link>
          <Link
            href={studentTabHref(id, returnTo, "family")}
            className={activeTab === "family" ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium" : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"}
          >
            Familia
          </Link>
        </div>
      </nav>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        {activeTab === "account" ? <div className="order-last min-w-0 space-y-7 xl:order-none xl:col-span-2 xl:row-start-1">
          {accountResult.error || !accountResult.data ? (
            <AccountLoadError studentId={student.id} />
          ) : (
            <StudentAccountView
              student={{ id: student.id, fullName: student.fullName, context: studentContext }}
              account={accountResult.data}
              payments={accountPaymentsResult.data}
              hasEmailRecipients={!emailRecipientsResult.error && emailRecipientsResult.data.length > 0}
              currentReceiverId={paymentContextResult.data?.currentReceiverId ?? null}
              isMaster={roles.includes("MASTER")}
              paymentDetailsError={accountPaymentsResult.error}
              operationalCycleId={operationalCycleId}
            />
          )}
        </div> : activeTab === "summary" ? <div className="order-last space-y-7 xl:order-none xl:col-start-1 xl:row-start-1">
          <SummarySection title="Cuenta">
            {accountSummaryResult.error || !accountSummaryResult.data ? (
              <p className="text-sm text-muted-foreground">No pudimos cargar el resumen financiero.</p>
            ) : (
              <AccountSummary summary={accountSummaryResult.data} compact />
            )}
          </SummarySection>

          <SummarySection title="Datos básicos" action={<EditStudentBasicsSheet student={{ id: student.id, fullName: student.fullName, birthDate: student.birthDate, sex: student.sex }} />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Fecha de nacimiento" value={student.birthDate ? formatDate(student.birthDate) : "Sin especificar"} />
              <Detail label="Sexo" value={student.sex === "H" ? "Hombre" : student.sex === "M" ? "Mujer" : "Sin especificar"} />
            </dl>
          </SummarySection>

          <SummarySection title="Situación escolar">
            {enrollment ? <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Ciclo" value={enrollment.cycle.name} />
              <Detail label="Estado" value={formatEnrollmentStatus(enrollment.status)} />
              <Detail label="Nivel" value={enrollment.educationLevel.name} />
              <Detail label="Grado" value={enrollment.gradeLevel.name} />
              <Detail label="Grupo" value={enrollment.group ? getEnrollmentGroupLabel(enrollment.group) : "Sin grupo asignado"} />
              <Detail label="Clasificación" value={enrollment.classification.name} />
            </dl> : <p className="text-sm text-muted-foreground">Este alumno no tiene una matrícula en el ciclo operativo actual.</p>}
          </SummarySection>

          <SummarySection title="Situación financiera">
            {accountSummaryResult.error || !accountSummaryResult.data ? <p className="text-sm text-muted-foreground">No pudimos cargar el resumen financiero.</p> : <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Estado" value={accountSummaryResult.data.isCurrent ? "Al corriente" : "Con saldo vencido"} />
                <Detail label="Saldo vencido" value={formatCurrency(Number(accountSummaryResult.data.overdueTotal))} />
                {Number(accountSummaryResult.data.availableCredit) > 0 && <Detail label="Saldo a favor" value={formatCurrency(Number(accountSummaryResult.data.availableCredit))} />}
              </dl>
            </>}
          </SummarySection>

          <SummarySection title="Familia">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Tutores registrados" value={String(student.guardians.length)} />
              <Detail label="Accesos familiares activos" value={String(student.familyAccess.filter((access) => access.status === "ACTIVE").length)} />
            </dl>
          </SummarySection>
        </div> : activeTab === "enrollment" ? <div className="order-last space-y-7 xl:order-none xl:col-start-1 xl:row-start-1">
          <SummarySection
            title="Datos escolares"
            action={schoolActionsAvailable && actionEnrollment ? (
              <EnrollmentActions
                section="school"
                schoolAction="editor"
                enrollment={actionEnrollment}
                canGraduate={isGraduationEligible(actionEnrollment)}
                grades={catalogs?.grades ?? []}
                educationLevels={catalogs?.levels ?? []}
                groups={actionGroupsResult.data ?? []}
                classifications={catalogs?.classifications ?? []}
                tenPaymentPlans={actionPlansResult.data}
                financialCoverage={actionFinancialCoverageResult.data}
                discountCategories={actionDiscountCategoriesResult.data}
              />
            ) : undefined}
          >
            {actionEnrollment ? (
              <>
                <EnrollmentCycleSelect
                  cycles={(catalogs?.cycles ?? []).filter((cycle) => historicalEnrollments.some((item) => item.cycleId === cycle.id))}
                  value={actionEnrollment?.cycleId ?? ""}
                />
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Ciclo" value={actionEnrollment.cycle.name} />
                  <Detail label="Matrícula" value={formatEnrollmentStatus(actionEnrollment.status)} />
                  <Detail label="Nivel" value={actionEnrollment.educationLevel.name} />
                  <Detail label="Grado" value={actionEnrollment.gradeLevel.name} />
                  <Detail label="Grupo" value={actionEnrollment.group ? getEnrollmentGroupLabel(actionEnrollment.group) : "Sin grupo asignado"} />
                  <Detail label="Clasificación" value={actionEnrollment.classification.name} />
                  <Detail label="Fecha de matrícula" value={formatDate(actionEnrollment.enrolledOn)} />
                  <Detail
                    label="Inicio de clases"
                    value={actionEnrollment.classesStartOn ? formatDate(actionEnrollment.classesStartOn) : "Sin fecha registrada"}
                  />
                  {actionEnrollment && <Detail
                    label="Inicio financiero"
                    value={actionEnrollment.economicStartOn ? formatDate(actionEnrollment.economicStartOn) : "Sin fecha registrada"}
                  />}
                  {actionEnrollment?.closedOn && <Detail label="Fecha de cierre" value={formatDate(actionEnrollment.closedOn)} />}
                </dl>
                {schoolActionsAvailable && actionEnrollment && (
                  <EnrollmentActions
                    section="school"
                    schoolAction="quick"
                    enrollment={actionEnrollment}
                    canGraduate={isGraduationEligible(actionEnrollment)}
                    grades={catalogs?.grades ?? []}
                    educationLevels={catalogs?.levels ?? []}
                    groups={actionGroupsResult.data ?? []}
                    classifications={catalogs?.classifications ?? []}
                    tenPaymentPlans={actionPlansResult.data}
                    financialCoverage={actionFinancialCoverageResult.data}
                    discountCategories={actionDiscountCategoriesResult.data}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este alumno no tiene matrículas registradas.
              </p>
            )}
          </SummarySection>

          {actionEnrollment && <SummarySection title="Configuración financiera">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Plan"
                value={actionEnrollment.currentPlan ? `${actionEnrollment.currentPlan.installmentCount} pagos` : "Sin plan asignado"}
              />
              <Detail
                label="Colegiatura acordada"
                value={actionEnrollment.currentTuition ? formatCurrency(actionEnrollment.currentTuition.agreedAmount) : "Sin dato"}
              />
              <Detail
                label="Descuento"
                value={actionEnrollment.currentDiscount?.name ?? "Sin descuento asignado"}
              />
              <Detail
                label="Inicio financiero"
                value={actionEnrollment.economicStartOn ? formatDate(actionEnrollment.economicStartOn) : "Sin fecha registrada"}
              />
              <Detail label="Inscripción" value={enrollmentFeeAmount === null ? "Sin cargo" : formatCurrency(enrollmentFeeAmount)} />
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4"><EditEnrollmentFeeSheet enrollmentId={actionEnrollment.id} chargeId={enrollmentFeeCharge?.id ?? null} amount={enrollmentFeeAmount} dueDate={actionEnrollment.enrolledOn} /></div>
            {financialActionsAvailable && (
              <EnrollmentActions
                section="financial"
                enrollment={actionEnrollment}
                grades={catalogs?.grades ?? []}
                educationLevels={catalogs?.levels ?? []}
                groups={actionGroupsResult.data ?? []}
                classifications={catalogs?.classifications ?? []}
                tenPaymentPlans={actionPlansResult.data}
                financialCoverage={actionFinancialCoverageResult.data}
                discountCategories={actionDiscountCategoriesResult.data}
              />
            )}
          </SummarySection>}

        </div> : activeTab === "academic" ? <div className="order-last space-y-7 xl:order-none xl:col-start-1 xl:row-start-1">
          <SummarySection title="Académico">
            <p className="text-sm font-medium">Próximamente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Las calificaciones estarán disponibles cuando se habilite el módulo académico.
            </p>
          </SummarySection>
        </div> : <div className="order-last space-y-7 xl:order-none xl:col-start-1 xl:col-start-1 xl:row-start-1">
          <SummarySection title="Tutores">
            {student.guardians.length ? (
              <>
                <div className="divide-y divide-border">
                  {student.guardians.map((guardian) => (
                    <div key={`${guardian.fullName}-${guardian.relationship}`} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {guardian.fullName}
                            {student.familyAccess.some((access) => access.guardianId === guardian.guardianId && access.status === "ACTIVE") && (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                                aria-label="Cuenta familiar activa"
                                title="Cuenta familiar activa"
                              >
                                <ShieldCheck className="size-3.5" />
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{guardian.relationship}</p>
                          {guardian.phone && <p className="mt-1 text-sm text-muted-foreground">{guardian.phone}</p>}
                          {guardian.email && <p className="mt-1 break-words text-sm text-muted-foreground">{guardian.email}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1"><EditGuardianSheet studentId={student.id} guardian={guardian} /><FamilyAccessSheet guardianId={guardian.guardianId} guardianName={guardian.fullName} /><UnlinkGuardianDialog studentId={student.id} studentName={student.fullName} guardianId={guardian.guardianId} guardianName={guardian.fullName} /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4"><AddGuardianSheet studentId={student.id} /></div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No hay tutores registrados.</p>
                <div className="mt-4"><AddGuardianSheet studentId={student.id} /></div>
              </>
            )}
          </SummarySection>

          <SummarySection title="Acceso familiar">
            {student.familyAccess.length ? (
              <div className="divide-y divide-border">
                {student.familyAccess.map((access) => (
                  <div key={`${access.guardianName}-${access.status}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{access.guardianName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {access.status === "ACTIVE" ? "Acceso activo" : "Acceso inactivo"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este alumno todavía no tiene cuentas familiares vinculadas.
              </p>
            )}
          </SummarySection>
        </div>}

      </div>
    </div>
  )
}

function isGraduationEligible(enrollment: EnrollmentListItem) {
  return enrollment.gradeLevel.isTerminal === true
}

function validReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/admin/alumnos")) {
    return "/admin/alumnos"
  }

  return value
}

function studentTabHref(studentId: string, returnTo: string, tab: "summary" | "account" | "enrollment" | "academic" | "family") {
  const params = new URLSearchParams()
  if (tab !== "summary") params.set("tab", tab)
  if (returnTo !== "/admin/alumnos") params.set("returnTo", returnTo)
  const query = params.toString()
  return `/admin/alumnos/${studentId}${query ? `?${query}` : ""}`
}

function paymentUnavailableReason(
  chargesError: boolean,
  contextError: boolean,
  currentReceiverId: string | null | undefined,
  receiverCount: number,
  canReceiveForOthers: boolean
) {
  if (chargesError || contextError) return "No pudimos preparar el registro de pago."
  if (!receiverCount) return "No hay receptores activos disponibles."
  if (!canReceiveForOthers && !currentReceiverId) {
    return "Tu usuario no tiene un registro de staff activo para recibir pagos."
  }
  return undefined
}

function AccountLoadError({ studentId }: { studentId: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        No pudimos cargar el resumen financiero.
      </p>
      <Link
        href={`/admin/alumnos/${studentId}/cuenta`}
        className="mt-3 inline-flex min-h-9 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Intentar de nuevo
      </Link>
    </div>
  )
}

function SummarySection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}

function StudentDetailLoadError() {
  return (
    <div className="border-y border-border bg-white px-4 py-10">
      <h1 className="text-lg font-semibold">No pudimos cargar este alumno.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Inténtalo de nuevo en unos momentos.</p>
      <Link href="/admin/alumnos" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">
        Volver a alumnos
      </Link>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value)
}
