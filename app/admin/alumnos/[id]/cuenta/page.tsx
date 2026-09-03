import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { RegisterPaymentSheet } from "@/components/admin/register-payment-sheet"
import { StudentAccountView } from "@/components/admin/student-account-view"
import { getStudentAccount, getStudentPaymentDetails } from "@/lib/admin/student-account"
import { getPaymentFormContext } from "@/lib/admin/payments"
import { getStudentEmailRecipients } from "@/lib/email/recipients"
import { getStudentCatalogs, getStudentDetail } from "@/lib/admin/students"
import { getEnrollmentGroupLabel } from "@/lib/admin/enrollments"
import { requireRole } from "@/lib/auth/require-role"

type StudentAccountPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StudentAccountPage({ params, searchParams }: StudentAccountPageProps) {
  const { id } = await params
  const query = await searchParams
  const returnTo = validReturnTo(query.returnTo)
  const { roles, supabase, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError) return <StudentAccountLoadError studentId={id} />

  const [
    { data: student, error: studentError },
    accountResult,
    paymentContextResult,
    emailRecipientsResult,
  ] = await Promise.all([
    getStudentDetail(supabase, id, catalogs?.operationalCycle?.id),
    getStudentAccount(supabase, id),
    getPaymentFormContext(supabase, userId),
    getStudentEmailRecipients(supabase, id),
  ])

  if (studentError) return <StudentAccountLoadError studentId={id} />
  if (!student) notFound()
  if (accountResult.error || !accountResult.data) {
    return <StudentAccountLoadError studentId={student.id} studentName={student.fullName} />
  }

  const { charges, movements } = accountResult.data
  const paymentIds = movements
    .filter((movement) => movement.movementType === "PAYMENT")
    .map((movement) => movement.id)
  const paymentDetailsResult = await getStudentPaymentDetails(supabase, student.id, paymentIds)
  const schoolContext = student.enrollment
    ? `${student.enrollment.educationLevel.name} · ${student.enrollment.gradeLevel.name}${student.enrollment.group ? ` ${getEnrollmentGroupLabel(student.enrollment.group)}` : ""}`
    : "Sin matrícula en el ciclo operativo"

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link
          href={studentDetailHref(student.id, returnTo)}
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
            hasEmailRecipients={!emailRecipientsResult.error && emailRecipientsResult.data.length > 0}
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

      <StudentAccountView
        student={{ id: student.id, fullName: student.fullName, context: schoolContext }}
        account={accountResult.data}
        payments={paymentDetailsResult.data}
        hasEmailRecipients={!emailRecipientsResult.error && emailRecipientsResult.data.length > 0}
        currentReceiverId={paymentContextResult.data?.currentReceiverId ?? null}
        isMaster={roles.includes("MASTER")}
        paymentDetailsError={paymentDetailsResult.error}
        operationalCycleId={catalogs?.operationalCycle?.id}
      />
    </div>
  )
}

function validReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/admin/alumnos")) {
    return "/admin/alumnos"
  }

  return value
}

function studentDetailHref(studentId: string, returnTo: string) {
  if (returnTo === "/admin/alumnos") return `/admin/alumnos/${studentId}`
  return `/admin/alumnos/${studentId}?returnTo=${encodeURIComponent(returnTo)}`
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
