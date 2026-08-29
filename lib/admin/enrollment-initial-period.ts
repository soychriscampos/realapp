import type { EnrollmentFinancialCoverage } from "@/lib/admin/enrollments"

export type InitialPeriodState = {
  firstOrdinaryPeriodStart: string | null
  isBeforeFirstOrdinaryPeriod: boolean
  needsInitialAmount: boolean
}

export function getFirstOrdinaryPeriodStart(
  financialCoverage: EnrollmentFinancialCoverage[],
  cycleId: string,
  educationLevelId: string | undefined,
): string | null {
  const coverage = financialCoverage.find(
    (item) => item.cycleId === cycleId && item.educationLevelId === educationLevelId,
  )
  if (!coverage?.months.length) return null

  const firstPeriod = coverage.months.reduce((earliest, item) =>
    item.year * 12 + item.month < earliest.year * 12 + earliest.month ? item : earliest,
  )
  return `${firstPeriod.year}-${String(firstPeriod.month).padStart(2, "0")}-01`
}

export function getInitialPeriodState({
  financialCoverage,
  cycleId,
  educationLevelId,
  proposedEconomicStartOn,
}: {
  financialCoverage: EnrollmentFinancialCoverage[]
  cycleId: string
  educationLevelId: string | undefined
  proposedEconomicStartOn: string
}): InitialPeriodState {
  const firstOrdinaryPeriodStart = getFirstOrdinaryPeriodStart(financialCoverage, cycleId, educationLevelId)
  const isBeforeFirstOrdinaryPeriod = Boolean(
    firstOrdinaryPeriodStart && proposedEconomicStartOn && proposedEconomicStartOn < firstOrdinaryPeriodStart,
  )

  if (isBeforeFirstOrdinaryPeriod) {
    return { firstOrdinaryPeriodStart, isBeforeFirstOrdinaryPeriod, needsInitialAmount: true }
  }

  const [year, month, day] = proposedEconomicStartOn.split("-").map(Number)
  const coverage = financialCoverage.find(
    (item) => item.cycleId === cycleId && item.educationLevelId === educationLevelId,
  )
  const startsInsideOrdinaryPeriod = Boolean(
    year && month && day && coverage?.months.some((item) => item.year === year && item.month === month),
  )

  return {
    firstOrdinaryPeriodStart,
    isBeforeFirstOrdinaryPeriod,
    needsInitialAmount: startsInsideOrdinaryPeriod && day > 1,
  }
}
