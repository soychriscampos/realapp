import { formatCurrency, type StudentAccountSummary } from "@/lib/admin/student-account"

type FinancialStatusProps = {
  summary: StudentAccountSummary
  className?: string
}

export function FinancialStatus({ summary, className }: FinancialStatusProps) {
  const overdue = amountNumber(summary.overdueTotal)
  const label = overdue > 0
    ? "Con saldo vencido"
    : "Al corriente"

  return (
    <p
      className={[
        "text-sm font-medium",
        overdue > 0 ? "text-destructive" : "text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </p>
  )
}

export function AccountSummary({
  summary,
  compact = false,
}: {
  summary: StudentAccountSummary
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="space-y-3">
        <FinancialStatus summary={summary} />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(summary.overdueTotal)}
            </p>
          </div>
          {amountNumber(summary.overdueTotal) > 0 && (
            <p className="shrink-0 text-sm font-medium text-destructive tabular-nums">
              {formatCurrency(summary.overdueTotal)} vencido
            </p>
          )}
        </div>
        {amountNumber(summary.availableCredit) > 0 && (
          <p className="text-sm font-medium text-emerald-700">
            {formatCurrency(summary.availableCredit)} a favor
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="mt-1 break-all text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
            {formatCurrency(summary.overdueTotal)}
          </p>
        </div>
        <FinancialStatus summary={summary} />
      </div>

      <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <AccountMetric
          label="Vencido"
          value={formatCurrency(summary.overdueTotal)}
          valueClassName={amountNumber(summary.overdueTotal) > 0 ? "text-destructive" : undefined}
        />
        <AccountMetric
          label="Saldo a favor"
          value={formatCurrency(summary.availableCredit)}
          valueClassName={amountNumber(summary.availableCredit) > 0 ? "text-emerald-700" : undefined}
        />
      </dl>
    </div>
  )
}

function AccountMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={["mt-1 break-all text-lg font-semibold tabular-nums", valueClassName].filter(Boolean).join(" ")}>
        {value}
      </dd>
    </div>
  )
}

function amountNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
