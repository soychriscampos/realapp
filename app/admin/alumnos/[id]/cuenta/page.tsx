import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccountSummary } from "@/components/admin/student-account"
import { RegisterPaymentSheet } from "@/components/admin/register-payment-sheet"
import { StudentAccountDetails } from "@/components/admin/student-account-details"
import { getStudentAccount } from "@/lib/admin/student-account"
import { getPaymentFormContext } from "@/lib/admin/payments"
import { getStudentCatalogs, getStudentDetail } from "@/lib/admin/students"
import { requireRole } from "@/lib/auth/require-role"

type StudentAccountPageProps = {
  params: Promise<{ id: string }>
}

export default async function StudentAccountPage({ params }: StudentAccountPageProps) {
  const { id } = await params
  const { roles, supabase, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError) return <StudentAccountLoadError studentId={id} />

  const [
    { data: student, error: studentError },
    accountResult,
    paymentContextResult,
  ] = await Promise.all([
    getStudentDetail(supabase, id, catalogs?.operationalCycle?.id),
    getStudentAccount(supabase, id),
    getPaymentFormContext(supabase, userId),
  ])

  if (studentError) return <StudentAccountLoadError studentId={id} />
  if (!student) notFound()
  if (accountResult.error || !accountResult.data) {
    return <StudentAccountLoadError studentId={student.id} studentName={student.fullName} />
  }

  const { summary, charges, movements } = accountResult.data
  const schoolContext = student.enrollment
    ? `${student.enrollment.gradeLevel.name}${student.enrollment.group ? ` · ${student.enrollment.group.name}` : ""}`
    : "Sin matrícula en el ciclo operativo"

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link
          href={`/admin/alumnos/${student.id}`}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" />
          {student.fullName}
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">
              Estado de cuenta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{student.fullName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{schoolContext}</p>
          </div>
          <RegisterPaymentSheet
            student={{ id: student.id, fullName: student.fullName, context: schoolContext }}
            charges={charges}
            methods={paymentContextResult.data?.methods ?? []}
            receivers={paymentContextResult.data?.receivers ?? []}
            currentReceiverId={paymentContextResult.data?.currentReceiverId ?? null}
            canReceiveForOthers={roles.includes("MASTER")}
            disabledReason={paymentUnavailableReason(
              paymentContextResult.error,
              paymentContextResult.data?.currentReceiverId,
              paymentContextResult.data?.receivers.length ?? 0,
              roles.includes("MASTER")
            )}
            triggerClassName="w-full sm:w-auto"
          />
        </div>
      </header>

      <section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border sm:px-5" aria-labelledby="account-summary">
        <h2 id="account-summary" className="text-base font-semibold">Resumen financiero</h2>
        <div className="mt-4">
          <AccountSummary summary={summary} />
        </div>
      </section>

      <StudentAccountDetails
        charges={charges}
        movements={movements}
        operationalCycleId={catalogs?.operationalCycle?.id}
      />
    </div>
  )
}

function paymentUnavailableReason(
  contextError: boolean,
  currentReceiverId: string | null | undefined,
  receiverCount: number,
  canReceiveForOthers: boolean
) {
  if (contextError) return "No pudimos preparar el registro de pago."
  if (!receiverCount) return "No hay receptores activos disponibles."
  if (!canReceiveForOthers && !currentReceiverId) {
    return "Tu usuario no tiene un registro de staff activo para recibir pagos."
  }
  return undefined
}

function StudentAccountLoadError({
  studentId,
  studentName,
}: {
  studentId: string
  studentName?: string
}) {
  return (
    <div className="max-w-lg border-y border-border bg-white px-4 py-10 sm:rounded-xl sm:border">
      {studentName && <p className="text-sm text-muted-foreground">{studentName}</p>}
      <h1 className="mt-1 text-lg font-semibold">No pudimos cargar el estado de cuenta.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Inténtalo de nuevo en unos momentos.
      </p>
      <Link
        href={`/admin/alumnos/${studentId}/cuenta`}
        className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Intentar de nuevo
      </Link>
    </div>
  )
}
