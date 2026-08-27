import type {
  StudentAccount,
  StudentChargeBalance,
  StudentPaymentDetail,
} from "@/lib/admin/student-account"
import { isChargeVisibleInCycle } from "@/lib/admin/student-account"
import type { StudentDetail } from "@/lib/admin/students"
import type {
  AccountStatementCharge,
  AccountStatementMovement,
  AccountStatementPdfData,
} from "./account-statement"

export function buildAccountStatementPdfData(
  student: StudentDetail,
  account: StudentAccount,
  paymentDetails: StudentPaymentDetail[],
  generatedAt = new Date()
): AccountStatementPdfData {
  const cutoff = dateKey(generatedAt)
  const cutoffDate = toDate(generatedAt)
  const currentCycleId = student.enrollment?.cycle.id ?? null
  const relevantCycleIds = new Set<string>()
  if (currentCycleId) relevantCycleIds.add(currentCycleId)

  for (const charge of account.charges) {
    if (
      charge.cycleId !== currentCycleId &&
      Number(charge.outstandingAmount) > 0
    ) {
      relevantCycleIds.add(charge.cycleId)
    }
  }

  const charges = account.charges
    .filter((charge) => {
      if (!relevantCycleIds.has(charge.cycleId)) return false
      if (charge.cycleId === currentCycleId && !isChargeVisibleInCycle(charge, cutoffDate)) return false
      return charge.cycleId === currentCycleId || Number(charge.outstandingAmount) > 0
    })
    .map(toDocumentCharge)

  const chargeById = new Map(account.charges.map((charge) => [charge.id, charge]))
  const paymentCycleIds = getPaymentCycleIds(account.charges, currentCycleId)
  const movements = paymentDetails
    .filter((payment) => dateKey(payment.receivedAt) <= cutoff && payment.status !== "VOID")
    .flatMap((payment) => {
      const linkedCharges = payment.allocations
        .map((allocation) => chargeById.get(allocation.chargeId))
        .filter((charge): charge is StudentChargeBalance => Boolean(charge))

      if (!linkedCharges.some((charge) => paymentCycleIds.has(charge.cycleId))) return []

      return [toDocumentPayment(payment, linkedCharges)]
    })
    .sort((left, right) => {
      const byDate = right.movementOn.localeCompare(left.movementOn)
      return byDate || right.recordedAt.localeCompare(left.recordedAt)
    })

  const overdueAmount = account.summary.overdueTotal

  return {
    student: {
      fullName: student.fullName,
      studentCode: student.studentCode,
      enrollment: student.enrollment,
    },
    generatedAt,
    currentCycleId,
    status: Number(overdueAmount) > 0 ? "ADEUDO" : "AL CORRIENTE",
    pendingAmount: Number(overdueAmount) > 0 ? overdueAmount : null,
    charges,
    movements,
  }
}

function toDocumentCharge(charge: StudentChargeBalance): AccountStatementCharge {
  return {
    id: charge.id,
    cycleId: charge.cycleId,
    cycleCode: charge.cycleCode,
    conceptCode: charge.conceptCode,
    conceptName: charge.conceptName,
    coverageYear: charge.coverageYear,
    coverageMonth: charge.coverageMonth,
    dueDate: charge.dueDate,
    paidAmount: charge.totalApplied,
    outstandingAmount: charge.outstandingAmount,
  }
}

function toDocumentPayment(
  payment: StudentPaymentDetail,
  linkedCharges: StudentChargeBalance[]
): AccountStatementMovement {
  return {
    movementOn: payment.receivedAt,
    recordedAt: payment.receivedAt,
    description: `${payment.methodName ? `Pago ${payment.methodName}` : "Pago registrado"}${linkedCharges.length ? ` · ${linkedCharges.map(chargeLabel).join(", ")}` : ""}`,
    debit: "0",
    credit: payment.amount,
    cycleCode: unique(linkedCharges.map((charge) => charge.cycleCode)).join(", "),
  }
}

function chargeLabel(charge: StudentChargeBalance) {
  return charge.cycleCode ? `${charge.conceptName} ${charge.cycleCode}` : charge.conceptName
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function dateKey(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  return value.slice(0, 10)
}

function toDate(value: string | Date) {
  if (value instanceof Date) return value
  return new Date(`${value.slice(0, 10)}T12:00:00`)
}

function getPaymentCycleIds(charges: StudentChargeBalance[], currentCycleId: string | null) {
  const cycles = uniqueCycles(charges)
  const previousDebtCycles = cycles.filter(
    (cycle) => cycle.id !== currentCycleId && charges.some(
      (charge) => charge.cycleId === cycle.id && Number(charge.outstandingAmount) > 0
    )
  )

  if (!previousDebtCycles.length || !currentCycleId) return new Set([currentCycleId].filter(Boolean) as string[])

  const oldestPrevious = previousDebtCycles.reduce((oldest, cycle) =>
    cycleRank(cycle.code) < cycleRank(oldest.code) ? cycle : oldest
  )
  const oldestRank = cycleRank(oldestPrevious.code)
  const currentRank = cycleRank(cycles.find((cycle) => cycle.id === currentCycleId)?.code ?? "")

  return new Set(
    cycles
      .filter((cycle) => {
        const rank = cycleRank(cycle.code)
        return rank >= oldestRank && rank <= currentRank
      })
      .map((cycle) => cycle.id)
  )
}

function uniqueCycles(charges: StudentChargeBalance[]) {
  return Array.from(
    new Map(charges.map((charge) => [charge.cycleId, { id: charge.cycleId, code: charge.cycleCode }])).values()
  )
}

function cycleRank(code: string) {
  const match = code.match(/^(\d{2})/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}
