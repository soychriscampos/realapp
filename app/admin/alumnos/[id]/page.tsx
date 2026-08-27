import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccountSummary } from "@/components/admin/student-account"
import { RegisterPaymentSheet } from "@/components/admin/register-payment-sheet"
import { formatEnrollmentStatus } from "@/components/admin/student-list"
import {
  getStudentAccountSummary,
  getStudentChargeBalances,
} from "@/lib/admin/student-account"
import { getPaymentFormContext } from "@/lib/admin/payments"
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
  const accountHref = studentAccountHref(id, returnTo)
  const { roles, supabase, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError) return <StudentDetailLoadError />

  const [
    { data: student, error },
    accountSummaryResult,
    chargeBalancesResult,
    paymentContextResult,
  ] = await Promise.all([
    getStudentDetail(supabase, id, catalogs?.operationalCycle?.id),
    getStudentAccountSummary(supabase, id),
    getStudentChargeBalances(supabase, id),
    getPaymentFormContext(supabase, userId),
  ])

  if (error) return <StudentDetailLoadError />
  if (!student) notFound()

  const enrollment = student.enrollment
  const studentContext = enrollment
    ? `${enrollment.gradeLevel.name}${enrollment.group ? ` · ${enrollment.group.name}` : ""}`
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
          <span className="border-b-2 border-foreground px-1 pb-3 text-sm font-medium">Resumen</span>
          <Link
            href={accountHref}
            className="px-1 pb-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Cuenta
          </Link>
          <span className="px-1 pb-3 text-sm text-muted-foreground">Matrícula</span>
          <span className="px-1 pb-3 text-sm text-muted-foreground">Académico</span>
          <span className="px-1 pb-3 text-sm text-muted-foreground">Familia</span>
        </div>
      </nav>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <aside className="order-first space-y-7 xl:order-none xl:col-start-2">
          <SummarySection title="Cuenta">
            {accountSummaryResult.error || !accountSummaryResult.data ? (
              <AccountLoadError studentId={student.id} />
            ) : (
              <div className="space-y-4">
                <AccountSummary summary={accountSummaryResult.data} compact />
                <Link
                  href={accountHref}
                  className="inline-flex min-h-9 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Ver estado de cuenta
                </Link>
              </div>
            )}
          </SummarySection>

        </aside>

        <div className="order-last space-y-7 xl:order-none xl:col-start-1 xl:row-start-1">
          <SummarySection title="Matrícula actual">
            {enrollment ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Ciclo" value={enrollment.cycle.name} />
                <Detail label="Estado" value={formatEnrollmentStatus(enrollment.status)} />
                <Detail label="Nivel" value={enrollment.educationLevel.name} />
                <Detail label="Grado" value={enrollment.gradeLevel.name} />
                <Detail label="Grupo" value={enrollment.group?.name ?? "Sin grupo asignado"} />
                <Detail label="Clasificación" value={enrollment.classification.name} />
                <Detail label="Fecha de matrícula" value={formatDate(enrollment.enrolledOn)} />
                <Detail
                  label="Inicio de clases"
                  value={enrollment.classesStartOn ? formatDate(enrollment.classesStartOn) : "Sin fecha registrada"}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este alumno no tiene una matrícula en el ciclo operativo actual.
              </p>
            )}
          </SummarySection>

          <SummarySection title="Tutores">
            {student.guardians.length ? (
              <div className="divide-y divide-border">
                {student.guardians.map((guardian) => (
                  <div key={`${guardian.fullName}-${guardian.relationship}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{guardian.fullName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{guardian.relationship}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay tutores activos registrados.</p>
            )}
          </SummarySection>
        </div>

        <aside className="order-last space-y-7 xl:order-none xl:col-start-2 xl:row-start-2">
          <SummarySection title="Académico">
            <p className="text-sm text-muted-foreground">
              El resumen académico estará disponible próximamente.
            </p>
          </SummarySection>

          <SummarySection title="Datos del alumno">
            <dl className="space-y-4">
              {student.studentCode && <Detail label="Código" value={student.studentCode} />}
              {student.birthDate && <Detail label="Fecha de nacimiento" value={formatDate(student.birthDate)} />}
            </dl>
          </SummarySection>
        </aside>

      </div>
    </div>
  )
}

function validReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/admin/alumnos")) {
    return "/admin/alumnos"
  }

  return value
}

function studentAccountHref(studentId: string, returnTo: string) {
  if (returnTo === "/admin/alumnos") return `/admin/alumnos/${studentId}/cuenta`
  return `/admin/alumnos/${studentId}/cuenta?returnTo=${encodeURIComponent(returnTo)}`
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

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border">
      <h2 className="text-base font-semibold">{title}</h2>
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
