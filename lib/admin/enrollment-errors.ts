export type EnrollmentErrorContext = "activation" | "preregistration" | "plan" | "group" | "classification" | "grade" | "dates" | "withdrawal" | "reactivation" | "finalization" | "graduation" | "cycle_closure" | "no_continua"

export function mapEnrollmentError(message: string | undefined, context: EnrollmentErrorContext) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = defaultMessage(context)

  if (context === "activation") {
    if (includesAny(normalized, "student already has an enrollment for this cycle", "already has an enrollment")) {
      friendlyMessage = "El alumno ya tiene una matrícula registrada para este ciclo."
    } else if (normalized.includes("enrollment fee is required")) {
      friendlyMessage = "Debes indicar si la inscripción se cobrará completa o proporcional."
    } else if (normalized.includes("enrollment fee is already covered")) {
      friendlyMessage = "La inscripción ya está cubierta para este ciclo."
    } else if (normalized.includes("no enrollment fee base rate exists for activation date")) {
      friendlyMessage = "No existe una tarifa de inscripción configurada para esa fecha."
    } else if (normalized.includes("no tuition base rate exists for enrollment level, cycle and effective date")) {
      friendlyMessage = "No existe una colegiatura base configurada para ese nivel y fecha."
    } else if (isExclusionConstraint(normalized)) {
      friendlyMessage = "El alumno ya tiene una matrícula registrada para este ciclo."
    }
  }

  if (context === "preregistration") {
    if (normalized.includes("preregistration cannot be enrolled") || normalized.includes("preregistration not found")) {
      friendlyMessage = "Esta preinscripción ya no está disponible para convertir. Actualiza la pantalla."
    } else if (normalized.includes("student already has an enrollment for the target cycle") || normalized.includes("student already has an enrollment")) {
      friendlyMessage = "El alumno ya tiene una matrícula registrada para el ciclo destino."
    } else if (normalized.includes("classification_id is required")) {
      friendlyMessage = "Selecciona una clasificación para activar la matrícula."
    } else if (normalized.includes("enrollment fee is required")) {
      friendlyMessage = "Debes indicar si la inscripción se cobrará completa o proporcional."
    } else if (normalized.includes("enrollment fee is already covered")) {
      friendlyMessage = "La inscripción ya está cubierta para este ciclo."
    } else if (normalized.includes("enrollment_fee_amount is required")) {
      friendlyMessage = "Captura un importe válido para la inscripción proporcional."
    } else if (normalized.includes("no enrollment fee base rate exists")) {
      friendlyMessage = "No existe una tarifa de inscripción configurada para esa fecha."
    } else if (normalized.includes("no tuition base rate exists")) {
      friendlyMessage = "No existe una colegiatura base configurada para ese grado y fecha."
    } else if (normalized.includes("group") && (normalized.includes("not found") || normalized.includes("does not belong"))) {
      friendlyMessage = "El grupo seleccionado no corresponde al ciclo y grado de destino."
    } else if (normalized.includes("classification") && normalized.includes("not found")) {
      friendlyMessage = "La clasificación seleccionada no es válida."
    } else if (normalized.includes("effective_on must belong") || normalized.includes("activated_on must belong") || normalized.includes("economic_start_on must belong")) {
      friendlyMessage = "Las fechas de activación deben estar dentro del ciclo destino."
    } else if (isExclusionConstraint(normalized)) {
      friendlyMessage = "El alumno ya tiene una matrícula registrada para el ciclo destino."
    }
  }

  if (context === "plan") {
    if (normalized.includes("first tuition payment")) {
      friendlyMessage = "No se puede cambiar el plan porque ya existe un primer pago de colegiatura."
    } else if (normalized.includes("credit activity")) {
      friendlyMessage = "No se puede cambiar el plan porque ya existe actividad de crédito."
    } else if (normalized.includes("adjustment")) {
      friendlyMessage = "No se puede cambiar el plan porque existen ajustes en colegiaturas."
    } else if (normalized.includes("charge rules") || normalized.includes("proportional")) {
      friendlyMessage = "No se puede cambiar el plan porque existen reglas especiales que deben resolverse primero."
    } else if (normalized.includes("enrollment already has financial plan assignment history")) {
      friendlyMessage = "No se puede cambiar el plan porque la matrícula ya tiene historial de asignaciones financieras."
    } else if (includesAny(normalized, "target plan", "10 installments", "different cycle", "education level")) {
      friendlyMessage = "El plan seleccionado no es compatible con esta matrícula."
    } else if (normalized.includes("effective_on must belong to enrollment cycle") || normalized.includes("effective_on must belong enrollment cycle")) {
      friendlyMessage = "La fecha efectiva debe estar dentro del ciclo escolar."
    } else if (isExclusionConstraint(normalized)) {
      friendlyMessage = "No se puede cambiar el plan porque ya existe una asignación financiera equivalente."
    }
  }

  if (context === "group" || context === "classification") {
    if (normalized.includes("already has requested") || normalized.includes("already assigned")) {
      friendlyMessage = `La matrícula ya tiene ${context === "group" ? "ese grupo" : "esa clasificación"}.`
    } else if (normalized.includes("does not belong") || normalized.includes("not found")) {
      friendlyMessage = "La opción seleccionada no es válida para esta matrícula."
    } else if (normalized.includes("effective_on must belong to enrollment cycle") || normalized.includes("effective_on must belong enrollment cycle")) {
      friendlyMessage = "La fecha efectiva debe estar dentro del ciclo escolar."
    } else if (isExclusionConstraint(normalized)) {
      friendlyMessage = `No se puede cambiar ${context === "group" ? "el grupo" : "la clasificación"} porque ya existe un registro equivalente.`
    }
  }

  if (context === "grade" || context === "dates") {
    if (normalized.includes("must belong to enrollment cycle") || normalized.includes("outside enrollment cycle")) {
      friendlyMessage = "Las fechas deben estar dentro del ciclo escolar."
    } else if (normalized.includes("grade") && (normalized.includes("not found") || normalized.includes("does not belong"))) {
      friendlyMessage = "El grado seleccionado no es válido."
    } else if (normalized.includes("group") && (normalized.includes("not found") || normalized.includes("does not belong"))) {
      friendlyMessage = "El grupo seleccionado no corresponde al ciclo y grado."
    } else if (normalized.includes("closed_on")) {
      friendlyMessage = "La fecha de matrícula no puede ser posterior a la fecha de cierre."
    } else if (normalized.includes("already has requested") || normalized.includes("no changes")) {
      friendlyMessage = "No hay cambios que guardar."
    }
  }

  if (context === "withdrawal") {
    if (normalized.includes("future tuition has applied money") || normalized.includes("use custom")) {
      friendlyMessage = "Hay pagos o créditos aplicados a periodos futuros. Debes corregir su distribución antes de completar la baja."
    } else if (normalized.includes("below already applied amount")) {
      friendlyMessage = "El monto final no puede ser menor al importe ya aplicado en el periodo actual."
    } else if (normalized.includes("cannot precede enrolled_on") || normalized.includes("must belong to enrollment cycle")) {
      friendlyMessage = "La fecha de baja debe estar dentro del ciclo y no puede ser anterior al ingreso."
    } else if (normalized.includes("only an active enrollment")) {
      friendlyMessage = "Solo una matrícula activa puede darse de baja."
    } else if (normalized.includes("no active tuition charge")) {
      friendlyMessage = "No hay una colegiatura activa para aplicar el tratamiento seleccionado en este periodo."
    } else if (isExclusionConstraint(normalized)) {
      friendlyMessage = "La matrícula ya tiene un cambio de estado registrado. Actualiza la pantalla e inténtalo de nuevo."
    }
  }

  if (context === "reactivation") {
    if (normalized.includes("reactivation date must be after withdrawal date") || normalized.includes("reactivated_on cannot precede withdrawal date")) {
      friendlyMessage = "La fecha de reactivación debe ser posterior a la fecha de baja."
    } else if (normalized.includes("reactivated_on must belong to enrollment cycle")) {
      friendlyMessage = "La fecha de reactivación debe estar dentro del ciclo escolar."
    } else if (normalized.includes("only baja enrollment can be reactivated")) {
      friendlyMessage = "Solo se puede reactivar una matrícula que esté dada de baja."
    } else if (normalized.includes("economic_start_on must be on or after reactivation and inside cycle")) {
      friendlyMessage = "La fecha de inicio económico debe ser igual o posterior al reingreso y estar dentro del ciclo."
    } else if (normalized.includes("enrollment fee is already covered")) {
      friendlyMessage = "La inscripción ya está cubierta para este ciclo."
    } else if (normalized.includes("enrollment fee is required")) {
      friendlyMessage = "Debes indicar si la inscripción se cobrará completa o proporcional."
    } else if (normalized.includes("no enrollment fee base rate exists for reactivation date")) {
      friendlyMessage = "No existe una tarifa de inscripción configurada para esa fecha de reactivación."
    } else if (normalized.includes("initial tuition amount")) {
      friendlyMessage = "El monto del primer periodo solo aplica cuando el inicio económico cae dentro de un mes ya iniciado."
    } else if (normalized.includes("group does not belong")) {
      friendlyMessage = "El grupo seleccionado no corresponde al ciclo y grado de esta matrícula."
    } else if (normalized.includes("tuition agreement") || normalized.includes("default 12-payment plan")) {
      friendlyMessage = "No existe una configuración financiera vigente para reactivar esta matrícula."
    } else if (isExclusionConstraint(normalized)) {
      friendlyMessage = "La matrícula ya tiene un cambio registrado. Actualiza la pantalla e inténtalo de nuevo."
    }
  }

  if (context === "finalization") {
    if (normalized.includes("only an active school cycle")) {
      friendlyMessage = "Solo se puede finalizar un ciclo escolar activo."
    } else if (normalized.includes("effective_on must belong")) {
      friendlyMessage = "La fecha efectiva debe estar dentro del ciclo escolar."
    } else if (normalized.includes("enrollment changed")) {
      friendlyMessage = "Una matrícula cambió mientras se finalizaba el ciclo. Actualiza la pantalla e inténtalo de nuevo."
    }
  }

  if (context === "graduation") {
    if (normalized.includes("only finalizada enrollment")) {
      friendlyMessage = "Solo se puede egresar una matrícula finalizada."
    } else if (normalized.includes("not eligible for graduation")) {
      friendlyMessage = "Este grado no es elegible para egreso."
    } else if (normalized.includes("enrollment changed")) {
      friendlyMessage = "La matrícula cambió mientras se registraba el egreso. Actualiza la pantalla e inténtalo de nuevo."
    }
  }

  if (context === "cycle_closure") {
    if (normalized.includes("active enrollments remain")) {
      friendlyMessage = "Aún hay matrículas activas. Finaliza las matrículas antes de cerrar el ciclo."
    } else if (normalized.includes("only an active school cycle")) {
      friendlyMessage = "Solo se puede cerrar un ciclo escolar activo."
    } else if (normalized.includes("school cycle changed")) {
      friendlyMessage = "El ciclo cambió mientras se cerraba. Actualiza la pantalla e inténtalo de nuevo."
    }
  }

  if (context === "no_continua") {
    if (normalized.includes("already has an enrollment")) friendlyMessage = "El alumno ya tiene una matrícula registrada para el ciclo destino."
    else if (normalized.includes("only finalizada")) friendlyMessage = "Sólo se puede marcar como No continúa una matrícula finalizada del ciclo anterior."
    else if (normalized.includes("previous cycle")) friendlyMessage = "La matrícula seleccionada no corresponde al ciclo anterior inmediato."
  }

  if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = context === "withdrawal"
      ? "No tienes autorización para registrar esta baja."
      : context === "reactivation"
        ? "No tienes autorización para reactivar esta matrícula."
        : context === "finalization"
          ? "No tienes autorización para finalizar las matrículas."
        : context === "graduation"
          ? "No tienes autorización para registrar el egreso."
        : context === "grade" || context === "dates"
          ? "No tienes autorización para corregir los datos académicos."
        : context === "cycle_closure"
          ? "No tienes autorización para cerrar el ciclo escolar."
        : context === "no_continua"
          ? "No tienes autorización para marcar matrículas como No continúa."
        : context === "activation" || context === "preregistration"
          ? "No tienes autorización para crear esta matrícula."
          : `No tienes autorización para ${context === "plan" ? "cambiar el plan financiero" : context === "group" ? "cambiar el grupo" : "cambiar la clasificación"}.`
  }

  if (process.env.NODE_ENV !== "production" && technicalMessage) {
    return `${friendlyMessage} Detalle: ${technicalMessage}`
  }

  return friendlyMessage
}

function defaultMessage(context: EnrollmentErrorContext) {
  if (context === "activation") return "No pudimos activar la matrícula. Revisa los datos e inténtalo de nuevo."
  if (context === "preregistration") return "No pudimos convertir la preinscripción. Revisa los datos e inténtalo de nuevo."
  if (context === "plan") return "No pudimos cambiar el plan financiero. Revisa los datos e inténtalo de nuevo."
  if (context === "group") return "No pudimos cambiar el grupo. Revisa los datos e inténtalo de nuevo."
  if (context === "classification") return "No pudimos cambiar la clasificación. Revisa los datos e inténtalo de nuevo."
  if (context === "grade") return "No pudimos corregir el grado. Revisa los datos e inténtalo de nuevo."
  if (context === "dates") return "No pudimos corregir las fechas académicas. Revisa los datos e inténtalo de nuevo."
  if (context === "withdrawal") return "No pudimos completar la baja. Revisa los datos e inténtalo de nuevo."
  if (context === "finalization") return "No pudimos finalizar las matrículas. Revisa los datos e inténtalo de nuevo."
  if (context === "graduation") return "No pudimos registrar el egreso. Revisa los datos e inténtalo de nuevo."
  if (context === "cycle_closure") return "No pudimos cerrar el ciclo escolar. Revisa los datos e inténtalo de nuevo."
  if (context === "no_continua") return "No pudimos registrar la no continuidad. Revisa los datos e inténtalo de nuevo."
  return "No pudimos reactivar la matrícula. Revisa los datos e inténtalo de nuevo."
}

function includesAny(value: string, ...needles: string[]) {
  return needles.some((needle) => value.includes(needle))
}

function isExclusionConstraint(value: string) {
  return value.includes("conflicting key value violates exclusion constraint")
}
