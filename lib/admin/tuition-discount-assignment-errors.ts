export function mapTuitionDiscountAssignmentError(message: string | undefined) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = "No pudimos aplicar el descuento de colegiatura. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("effect_mode must be current, next or proportional")) {
    friendlyMessage = "Selecciona cómo debe aplicarse el descuento."
  } else if (normalized.includes("current_period_amount is required for proportional")) {
    friendlyMessage = "Captura el monto final del periodo actual para aplicar un importe proporcional."
  } else if (normalized.includes("current_period_amount cannot be negative")) {
    friendlyMessage = "El monto del periodo actual no puede ser negativo."
  } else if (normalized.includes("effective_on must belong to enrollment cycle")) {
    friendlyMessage = "La fecha efectiva debe estar dentro del ciclo escolar."
  } else if (normalized.includes("effective_on cannot precede current tuition agreement")) {
    friendlyMessage = "La fecha efectiva no puede ser anterior al acuerdo de colegiatura vigente."
  } else if (normalized.includes("effective_on cannot precede current discount assignment")) {
    friendlyMessage = "La fecha efectiva no puede ser anterior al descuento actual."
  } else if (normalized.includes("tuition discount category is inactive")) {
    friendlyMessage = "La categoría seleccionada está inactiva y no puede asignarse."
  } else if (normalized.includes("tuition discount category belongs to another cycle")) {
    friendlyMessage = "La categoría seleccionada no corresponde a este ciclo escolar."
  } else if (normalized.includes("tuition discount category not found")) {
    friendlyMessage = "No encontramos la categoría de descuento seleccionada."
  } else if (normalized.includes("no category version exists at effective_on")) {
    friendlyMessage = "La categoría no tiene un valor configurado para esa fecha efectiva."
  } else if (normalized.includes("no active tuition period exists")) {
    friendlyMessage = "No existe un periodo de colegiatura activo para aplicar el descuento."
  } else if (normalized.includes("enrollment has no current financial plan") || normalized.includes("enrollment has no current tuition agreement")) {
    friendlyMessage = "La matrícula no tiene una configuración de colegiatura vigente."
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para configurar descuentos de colegiatura."
  }

  if (process.env.NODE_ENV !== "production" && technicalMessage) {
    return `${friendlyMessage} Detalle: ${technicalMessage}`
  }

  return friendlyMessage
}
