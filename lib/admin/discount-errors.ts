export type DiscountErrorContext = "create" | "change" | "rename" | "status"

export function mapDiscountError(message: string | undefined, context: DiscountErrorContext) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = defaultMessage(context)

  if (normalized.includes("active discount category with this name already exists")) {
    friendlyMessage = "Ya existe una categoría activa con ese nombre en este ciclo."
  } else if (normalized.includes("another discount category with this name already exists")) {
    friendlyMessage = "Ya existe otra categoría con ese nombre."
  } else if (normalized.includes("category already has this name")) {
    friendlyMessage = "La categoría ya tiene ese nombre."
  } else if (normalized.includes("category already has this status")) {
    friendlyMessage = "La categoría ya tiene ese estado."
  } else if (normalized.includes("category version is already in use and cannot be corrected")) {
    friendlyMessage = "Esta versión ya fue utilizada en alumnos y no puede modificarse. Crea una nueva vigencia."
  } else if (normalized.includes("category name is required")) {
    friendlyMessage = "Indica un nombre para la categoría."
  } else if (normalized.includes("percentage discount cannot exceed 100")) {
    friendlyMessage = "El porcentaje de descuento no puede ser mayor a 100%."
  } else if (normalized.includes("value must be greater than zero")) {
    friendlyMessage = "El valor del descuento debe ser mayor que cero."
  } else if (normalized.includes("effective_on must belong to school cycle") || normalized.includes("effective_on must belong to category cycle")) {
    friendlyMessage = "La fecha efectiva debe estar dentro del ciclo escolar."
  } else if (normalized.includes("discount category is inactive")) {
    friendlyMessage = "La categoría de descuento está inactiva y no puede modificarse."
  } else if (normalized.includes("discount category not found")) {
    friendlyMessage = "No encontramos la categoría de descuento seleccionada."
  } else if (normalized.includes("a future category version already exists")) {
    friendlyMessage = "Ya existe una versión futura para esa fecha. Elige otra fecha efectiva."
  } else if (normalized.includes("no category version exists at effective_on")) {
    friendlyMessage = "No existe un valor vigente para esa fecha efectiva."
  } else if (normalized.includes("category version already has this value")) {
    friendlyMessage = "La categoría ya tiene ese valor vigente."
  } else if (normalized.includes("a category version already starts on effective_on")) {
    friendlyMessage = "Ya existe una versión que inicia en esa fecha. Elige otra fecha efectiva."
  } else if (normalized.includes("no overlap") || normalized.includes("exclusion constraint")) {
    friendlyMessage = "La fecha efectiva se cruza con otra versión. Elige una fecha distinta."
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para configurar descuentos de colegiatura."
  }

  if (process.env.NODE_ENV !== "production" && technicalMessage) {
    return `${friendlyMessage} Detalle: ${technicalMessage}`
  }

  return friendlyMessage
}

function defaultMessage(context: DiscountErrorContext) {
  if (context === "create") return "No pudimos crear la categoría de descuento. Revisa los datos e inténtalo de nuevo."
  if (context === "change") return "No pudimos cambiar el valor de la categoría. Revisa los datos e inténtalo de nuevo."
  if (context === "rename") return "No pudimos renombrar la categoría. Revisa los datos e inténtalo de nuevo."
  return "No pudimos cambiar el estado de la categoría. Revisa los datos e inténtalo de nuevo."
}
