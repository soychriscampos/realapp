export type TuitionDiscountType = "PERCENTAGE" | "FIXED_AMOUNT"

export function calculateTuitionDiscountPreview(baseAmount: number, type: TuitionDiscountType, value: number) {
  const discountAmount = type === "PERCENTAGE"
    ? Math.min(baseAmount, Math.max(0, Math.round(baseAmount * value) / 100))
    : Math.min(baseAmount, Math.max(0, value))
  return { discountAmount, agreedAmount: baseAmount - discountAmount }
}

export function formatTuitionDiscountValue(value: number, type: TuitionDiscountType) {
  return type === "PERCENTAGE"
    ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)}%`
    : formatCurrency(value)
}

export function tuitionDiscountTypeLabel(type: TuitionDiscountType) {
  return type === "PERCENTAGE" ? "Porcentaje" : "Monto fijo"
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
}
