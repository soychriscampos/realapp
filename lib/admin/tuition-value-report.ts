export type TuitionValueRow = {
  snapshot_date: string
  snapshot_kind: "CURRENT" | "MONTHLY"
  enrollment_id: string
  student_id: string
  education_level_id: string | null
  education_level_name: string | null
  grade_level_id: string | null
  grade_name: string | null
  status: string
  price_list: number | string | null
  effective_value: number | string | null
  benefit_value: number | string | null
  benefit_category_id: string | null
  benefit_category_name: string | null
  history_quality: "EXACT_EVENTS" | "CURRENT_SNAPSHOT_ONLY" | "PARTIAL"
  has_financial_agreement: boolean
  included_in_metrics: boolean
}

export type TuitionValueMetrics = {
  studentCount: number
  valuedStudentCount: number
  missingFinancialAgreementCount: number
  listPriceValue: number
  effectiveValue: number
  benefitValue: number
  averageTuition: number
  benefitedStudents: number
  fullPriceStudents: number
  benefitRate: number
  benefitRateValue: number
  priceRetention: number
}

export type TuitionValueBreakdown = TuitionValueMetrics & {
  levelId: string | null
  levelName: string
  gradeId: string | null
  gradeName: string
}

export type TuitionValueBenefitCategory = {
  categoryId: string
  categoryName: string
  studentCount: number
  listPriceValue: number
  effectiveValue: number
  benefitValue: number
  averageBenefit: number
}

export type TuitionValueReport = {
  current: TuitionValueMetrics
  levelBreakdown: TuitionValueBreakdown[]
  gradeBreakdown: TuitionValueBreakdown[]
  benefitCategories: TuitionValueBenefitCategory[]
  composition: { fullPriceStudents: number; benefitedStudents: number; benefitRate: number }
  evolution: Array<TuitionValueMetrics & { date: string; label: string; historyQuality: TuitionValueRow["history_quality"] }>
  hasPartialHistory: boolean
}

export function buildTuitionValueReport(rows: TuitionValueRow[], asOf: string): TuitionValueReport {
  const currentRows = rows.filter((row) => row.snapshot_kind === "CURRENT" && row.snapshot_date === asOf)
  const current = metrics(currentRows)
  const levelBreakdown = breakdown(currentRows, (row) => `${row.education_level_id ?? "none"}`).map((row) => ({ ...row, gradeId: null, gradeName: "" }))
  const gradeBreakdown = breakdown(currentRows, (row) => `${row.education_level_id ?? "none"}:${row.grade_level_id ?? "none"}`)
  const benefitCategories = categories(currentRows)
  const evolution = [...new Map(rows
    .filter((row) => row.snapshot_kind === "MONTHLY")
    .map((row) => [row.snapshot_date, row]))
    .keys()]
    .sort()
    .map((date) => {
      const monthRows = rows.filter((row) => row.snapshot_kind === "MONTHLY" && row.snapshot_date === date)
      return { date, label: formatMonth(date), ...metrics(monthRows), historyQuality: quality(monthRows) }
    })

  return {
    current,
    levelBreakdown,
    gradeBreakdown,
    benefitCategories,
    composition: {
      fullPriceStudents: current.fullPriceStudents,
      benefitedStudents: current.benefitedStudents,
      benefitRate: current.benefitRate,
    },
    evolution,
    hasPartialHistory: evolution.some((point) => point.historyQuality !== "EXACT_EVENTS"),
  }
}

function metrics(rows: TuitionValueRow[]): TuitionValueMetrics {
  const includedRows = rows.filter((row) => row.included_in_metrics)
  const values = includedRows.map(toValues)
  const listPriceValue = sum(values.map((value) => value.listPrice))
  const effectiveValue = sum(values.map((value) => value.effective))
  const benefitValue = sum(values.map((value) => value.benefit))
  const studentCount = includedRows.length
  const valuedStudentCount = values.filter((value) => value.hasAgreement).length
  const benefitedStudents = values.filter((value) => value.hasAgreement && value.benefit > 0).length
  const fullPriceStudents = values.filter((value) => value.hasAgreement && value.benefit === 0).length
  return {
    studentCount,
    valuedStudentCount,
    missingFinancialAgreementCount: studentCount - valuedStudentCount,
    listPriceValue,
    effectiveValue,
    benefitValue,
    averageTuition: valuedStudentCount ? effectiveValue / valuedStudentCount : 0,
    benefitedStudents,
    fullPriceStudents,
    benefitRate: valuedStudentCount ? benefitedStudents / valuedStudentCount : 0,
    benefitRateValue: listPriceValue ? benefitValue / listPriceValue : 0,
    priceRetention: listPriceValue ? effectiveValue / listPriceValue : 0,
  }
}

function breakdown(rows: TuitionValueRow[], keyFor: (row: TuitionValueRow) => string): TuitionValueBreakdown[] {
  const groups = new Map<string, TuitionValueRow[]>()
  for (const row of rows) groups.set(keyFor(row), [...(groups.get(keyFor(row)) ?? []), row])
  return [...groups.values()].map((group) => {
    const first = group[0]
    return {
      levelId: first.education_level_id,
      levelName: first.education_level_name ?? "Sin nivel",
      gradeId: first.grade_level_id,
      gradeName: first.grade_name ?? "Sin grado",
      ...metrics(group),
    }
  }).sort((left, right) => left.levelName.localeCompare(right.levelName, "es") || left.gradeName.localeCompare(right.gradeName, "es"))
}

function categories(rows: TuitionValueRow[]): TuitionValueBenefitCategory[] {
  const groups = new Map<string, TuitionValueRow[]>()
  for (const row of rows) {
    if (!row.benefit_category_id || toValues(row).benefit <= 0) continue
    groups.set(row.benefit_category_id, [...(groups.get(row.benefit_category_id) ?? []), row])
  }
  return [...groups.entries()].map(([categoryId, group]) => {
    const values = metrics(group)
    return {
      categoryId,
      categoryName: group[0].benefit_category_name ?? "Categoría sin nombre",
      studentCount: values.studentCount,
      listPriceValue: values.listPriceValue,
      effectiveValue: values.effectiveValue,
      benefitValue: values.benefitValue,
      averageBenefit: values.studentCount ? values.benefitValue / values.studentCount : 0,
    }
  }).sort((left, right) => right.benefitValue - left.benefitValue || left.categoryName.localeCompare(right.categoryName, "es"))
}

function toValues(row: TuitionValueRow) {
  const listPrice = number(row.price_list)
  const effective = number(row.effective_value)
  const benefit = Math.max(0, number(row.benefit_value) || listPrice - effective)
  return { listPrice, effective, benefit, hasAgreement: row.has_financial_agreement }
}

function quality(rows: TuitionValueRow[]): TuitionValueRow["history_quality"] {
  if (rows.some((row) => row.history_quality === "CURRENT_SNAPSHOT_ONLY")) return "CURRENT_SNAPSHOT_ONLY"
  if (rows.some((row) => row.history_quality === "PARTIAL")) return "PARTIAL"
  return "EXACT_EVENTS"
}

function number(value: number | string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }

function formatMonth(date: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
}
