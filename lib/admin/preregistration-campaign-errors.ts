export function mapPreregistrationCampaignError(message: string | undefined) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = "No pudimos crear la campaña. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("campaign name is required")) {
    friendlyMessage = "Indica un nombre para la campaña."
  } else if (normalized.includes("target cycle") && (normalized.includes("required") || normalized.includes("not found"))) {
    friendlyMessage = "Selecciona un ciclo destino válido."
  } else if (normalized.includes("education level not found")) {
    friendlyMessage = "El nivel educativo seleccionado no es válido."
  } else if (normalized.includes("covered financial concept")) {
    friendlyMessage = "El concepto financiero seleccionado no es válido o está inactivo."
  } else if (normalized.includes("price must be zero or greater")) {
    friendlyMessage = "El precio debe ser cero o mayor."
  } else if (normalized.includes("campaign end date cannot be before start date")) {
    friendlyMessage = "La fecha de fin debe ser igual o posterior a la fecha de inicio."
  } else if (normalized.includes("preregistration_campaigns_cycle_name_uq") || normalized.includes("duplicate key")) {
    friendlyMessage = "Ya existe una campaña con ese nombre para el ciclo seleccionado."
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para crear campañas de preinscripción."
  }

  if (process.env.NODE_ENV !== "production" && technicalMessage) {
    return `${friendlyMessage} Detalle: ${technicalMessage}`
  }

  return friendlyMessage
}

export function mapPreregistrationRegistrationError(message: string | undefined) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = "No pudimos registrar al alumno en la campaña. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("preregistration campaign not found")) {
    friendlyMessage = "La campaña ya no está disponible. Actualiza la pantalla e inténtalo de nuevo."
  } else if (normalized.includes("preregistration campaign is not active")) {
    friendlyMessage = "Solo se pueden agregar alumnos a una campaña activa."
  } else if (normalized.includes("student not found")) {
    friendlyMessage = "El alumno seleccionado ya no está disponible. Actualiza la búsqueda."
  } else if (normalized.includes("target grade not found")) {
    friendlyMessage = "Selecciona un grado destino válido."
  } else if (normalized.includes("target grade does not belong to campaign education level")) {
    friendlyMessage = "El grado seleccionado no corresponde al nivel educativo de la campaña."
  } else if (normalized.includes("student already has a preregistration for target cycle")) {
    friendlyMessage = "El alumno ya tiene una preinscripción para este ciclo destino."
  } else if (normalized.includes("student already has an enrollment for target cycle")) {
    friendlyMessage = "El alumno ya tiene una matrícula registrada para este ciclo destino."
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para registrar alumnos en esta campaña."
  }

  if (process.env.NODE_ENV !== "production" && technicalMessage) {
    return `${friendlyMessage} Detalle: ${technicalMessage}`
  }

  return friendlyMessage
}

export function mapPreregistrationIntakeError(message: string | undefined) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = "No pudimos registrar la preinscripción. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("preregistration date is outside campaign dates")) {
    friendlyMessage = "La fecha de preinscripción debe estar dentro de la vigencia de la campaña."
  } else if (normalized.includes("preregistration campaign not found")) {
    friendlyMessage = "La campaña seleccionada ya no está disponible. Actualiza la pantalla."
  } else if (normalized.includes("preregistration campaign is not active")) {
    friendlyMessage = "La campaña seleccionada ya no está activa."
  } else if (normalized.includes("cancelled campaign cannot be used")) {
    friendlyMessage = "No se puede usar una campaña cancelada para este registro."
  } else if (normalized.includes("retroactive preregistration date cannot be after enrollment date")) {
    friendlyMessage = "La fecha de preinscripción no puede ser posterior a la fecha de matrícula."
  } else if (normalized.includes("campaign does not belong to target cycle")) {
    friendlyMessage = "La campaña no corresponde al ciclo destino seleccionado."
  } else if (normalized.includes("campaign does not apply to target education level")) {
    friendlyMessage = "La campaña no corresponde al nivel educativo seleccionado."
  } else if (normalized.includes("target grade does not belong to education level")) {
    friendlyMessage = "El grado seleccionado no corresponde al nivel educativo."
  } else if (normalized.includes("target group is not valid for cycle and grade")) {
    friendlyMessage = "El grupo seleccionado no corresponde al ciclo y grado destino."
  } else if (normalized.includes("student already has a preregistration for target cycle")) {
    friendlyMessage = "El alumno ya tiene una preinscripción para este ciclo destino."
  } else if (normalized.includes("student already has an enrollment for target cycle")) {
    friendlyMessage = "El alumno ya tiene una matrícula registrada para este ciclo destino."
  } else if (normalized.includes("at least one contact is required")) {
    friendlyMessage = "Agrega al menos un contacto."
  } else if (normalized.includes("maximum of two contacts")) {
    friendlyMessage = "Solo puedes registrar un máximo de dos contactos."
  } else if (normalized.includes("contact phone is required")) {
    friendlyMessage = "Captura el teléfono de cada contacto."
  } else if (normalized.includes("contact full name is required")) {
    friendlyMessage = "Captura el nombre de cada contacto."
  } else if (normalized.includes("student full name is required")) {
    friendlyMessage = "Captura el nombre completo del alumno nuevo."
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para registrar esta preinscripción."
  }

  if (process.env.NODE_ENV !== "production" && technicalMessage) {
    return `${friendlyMessage} Detalle: ${technicalMessage}`
  }

  return friendlyMessage
}

export function mapRetroactivePreregistrationError(message: string | undefined) {
  const technicalMessage = message?.trim() ?? ""
  const normalized = technicalMessage.toLowerCase()
  let friendlyMessage = "No pudimos registrar la preinscripción retroactiva. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("preregistration campaign not found")) friendlyMessage = "La campaña seleccionada ya no está disponible."
  else if (normalized.includes("cancelled campaign cannot be used")) friendlyMessage = "No se puede usar una campaña cancelada para este registro."
  else if (normalized.includes("preregistration date is outside campaign dates")) friendlyMessage = "La fecha de preinscripción debe estar dentro de la vigencia de la campaña."
  else if (normalized.includes("student has no enrollment for campaign target cycle")) friendlyMessage = "El alumno no tiene matrícula en el ciclo destino de la campaña."
  else if (normalized.includes("retroactive preregistration date cannot be after enrollment date")) friendlyMessage = "La fecha de preinscripción no puede ser posterior a la fecha de matrícula."
  else if (normalized.includes("student already has a preregistration for target cycle")) friendlyMessage = "El alumno ya tiene una preinscripción para este ciclo."
  else if (normalized.includes("target grade not found") || normalized.includes("campaign does not apply to target education level")) friendlyMessage = "El grado seleccionado no es válido para esta campaña."
  else if (normalized.includes("target group is not valid for cycle and grade")) friendlyMessage = "El grupo seleccionado no corresponde al ciclo y grado."
  else if (normalized.includes("multiple enrollment fee charges require manual review")) friendlyMessage = "Existen múltiples cargos de inscripción. Se requiere revisión manual antes de registrar el antecedente."
  else if (normalized.includes("permission") || normalized.includes("authentication")) friendlyMessage = "No tienes autorización para registrar esta preinscripción retroactiva."

  if (process.env.NODE_ENV !== "production" && technicalMessage) return `${friendlyMessage} Detalle: ${technicalMessage}`
  return friendlyMessage
}
