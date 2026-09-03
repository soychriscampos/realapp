"use client"

import { ChevronRight } from "lucide-react"

import { PaymentDetailsSheet } from "@/components/admin/payment-details-sheet"
import { formatCurrency } from "@/lib/admin/student-account"
import type { AdminHomeRecentPayment } from "@/lib/admin/admin-home"

type AdminHomeRecentPaymentsProps = {
  payments: AdminHomeRecentPayment[]
  isMaster: boolean
}

export function AdminHomeRecentPayments({
  payments,
  isMaster,
}: AdminHomeRecentPaymentsProps) {
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
        No hay pagos recientes.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      {payments.map(({ studentId, studentName, payment, charges, hasEmailRecipients }) => (
        <div
          key={payment.id}
          className="flex min-h-[76px] items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{studentName}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {formatCurrency(payment.amount)} · {payment.methodName}
            </p>
            {isMaster && payment.receivedByName && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Recibido por: {payment.receivedByName}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-right">
            <div className="text-xs text-muted-foreground">
              {formatDateTime(payment.receivedAt)}
            </div>
            <PaymentDetailsSheet
              studentId={studentId}
              payment={payment}
              charges={charges}
              hasEmailRecipients={hasEmailRecipients}
              canManage={isMaster}
              triggerClassName="flex size-9 items-center justify-center rounded-lg hover:bg-muted hover:no-underline"
              triggerLabel={<ChevronRight className="size-4 text-muted-foreground" />}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
