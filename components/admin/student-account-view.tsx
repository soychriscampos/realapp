import { AccountSummary } from "@/components/admin/student-account"
import { AccountStatementDownloadButton } from "@/components/admin/account-statement-download-button"
import { StudentAccountDetails } from "@/components/admin/student-account-details"
import { SendAccountStatementButton } from "@/components/admin/send-account-statement-button"
import type { StudentAccount, StudentPaymentDetail } from "@/lib/admin/student-account"

type StudentAccountViewProps = {
  student: { id: string; fullName: string; context: string }
  account: StudentAccount
  payments: StudentPaymentDetail[]
  hasEmailRecipients: boolean
  currentReceiverId: string | null
  isMaster: boolean
  paymentDetailsError?: boolean
  operationalCycleId?: string
}

export function StudentAccountView({
  student,
  account,
  payments,
  hasEmailRecipients,
  currentReceiverId,
  isMaster,
  paymentDetailsError = false,
  operationalCycleId,
}: StudentAccountViewProps) {
  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Estado de cuenta</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <AccountStatementDownloadButton href={`/admin/alumnos/${student.id}/cuenta/pdf`} />
          <SendAccountStatementButton
            studentId={student.id}
            hasRecipients={hasEmailRecipients}
          />
        </div>
      </header>

      <section className="border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border sm:px-5" aria-labelledby="account-summary">
        <h2 id="account-summary" className="text-base font-semibold">Resumen financiero</h2>
        <div className="mt-4">
          <AccountSummary summary={account.summary} />
        </div>
      </section>

      <StudentAccountDetails
        charges={account.charges}
        movements={account.movements}
        payments={payments}
        studentId={student.id}
        hasEmailRecipients={hasEmailRecipients}
        currentReceiverId={currentReceiverId}
        isMaster={isMaster}
        paymentDetailsError={paymentDetailsError}
        operationalCycleId={operationalCycleId}
      />
    </div>
  )
}
