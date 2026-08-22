"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth/require-role"

export type CreateEnrollmentInput = {
  studentId: string
  cycleId: string
  gradeLevelId: string
  groupId: string | null
  classificationId: string
  classesStartOn: string | null
  activatedOn: string
  economicStartOn: string
  initialPeriodAmount: string | null
  initialPeriodDueDate: string | null
  reason: string
}

export type CreateEnrollmentResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; message: string; stage?: "enrollment" | "agreement" | "financials" | "activation" }

export type EnrollmentMutationResult =
  | { ok: true }
  | { ok: false; message: string }

export async function createEnrollment(
  input: CreateEnrollmentInput
): Promise<CreateEnrollmentResult> {
  const validationMessage = validate(input)
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: enrollmentId, error } = await supabase.rpc(
    "create_and_activate_enrollment",
    {
      p_student_id: input.studentId,
      p_cycle_id: input.cycleId,
      p_grade_level_id: input.gradeLevelId,
      p_classification_id: input.classificationId,
      p_group_id: cleanText(input.groupId),
      p_activated_on: input.activatedOn,
      p_classes_start_on: cleanText(input.classesStartOn),
      p_economic_start_on: input.economicStartOn,
      p_initial_period_amount: cleanText(input.initialPeriodAmount),
      p_initial_period_due_date: cleanText(input.initialPeriodDueDate),
      p_reason: input.reason.trim(),
    }
  )

  if (error || typeof enrollmentId !== "string" || !enrollmentId) {
    return {
      ok: false,
      stage: "enrollment",
      message: mapEnrollmentCreationError(error?.message),
    }
  }

  revalidatePath("/admin/matricula")
  revalidatePath(`/admin/alumnos/${input.studentId}`)

  return { ok: true, enrollmentId }
}

export async function changeEnrollmentFinancialPlan(input: {
  enrollmentId: string
  targetFinancialPlanId: string
  effectiveOn: string
  reason: string
}): Promise<EnrollmentMutationResult> {
  const validationMessage = validateMutationInput(input.effectiveOn, input.reason, "plan")
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("change_enrollment_financial_plan", {
    p_enrollment_id: input.enrollmentId,
    p_target_financial_plan_id: input.targetFinancialPlanId,
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapEnrollmentMutationError(error.message, "plan") }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function changeEnrollmentGroup(input: {
  enrollmentId: string
  groupId: string
  effectiveOn: string
  reason: string
}): Promise<EnrollmentMutationResult> {
  const validationMessage = validateMutationInput(input.effectiveOn, input.reason, "group")
  if (validationMessage || !input.groupId) {
    return { ok: false, message: validationMessage ?? "Selecciona un grupo nuevo." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("change_enrollment_group", {
    p_enrollment_id: input.enrollmentId,
    p_group_id: input.groupId,
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapEnrollmentMutationError(error.message, "group") }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function changeEnrollmentClassification(input: {
  enrollmentId: string
  classificationId: string
  effectiveOn: string
  reason: string
}): Promise<EnrollmentMutationResult> {
  const validationMessage = validateMutationInput(input.effectiveOn, input.reason, "classification")
  if (validationMessage || !input.classificationId) {
    return { ok: false, message: validationMessage ?? "Selecciona una clasificación nueva." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("change_enrollment_classification", {
    p_enrollment_id: input.enrollmentId,
    p_classification_id: input.classificationId,
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapEnrollmentMutationError(error.message, "classification") }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function withdrawEnrollment(input: {
  enrollmentId: string
  withdrawnOn: string
  mode: "STOP_FUTURE" | "KEEP_REMAINING"
  currentPeriodAction: "KEEP_FULL" | "PROPORTIONAL" | "AGREED" | "WAIVE"
  currentPeriodAmount: string | null
  reason: string
}): Promise<EnrollmentMutationResult> {
  if (!isDate(input.withdrawnOn)) {
    return { ok: false, message: "Captura una fecha efectiva de baja válida." }
  }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo de la baja." }

  const requiresAmount = input.currentPeriodAction === "PROPORTIONAL" || input.currentPeriodAction === "AGREED"
  const amount = input.currentPeriodAmount?.trim() ?? ""
  if (requiresAmount && (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    return { ok: false, message: "Captura un monto final válido para el periodo actual." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("process_financial_withdrawal", {
    p_enrollment_id: input.enrollmentId,
    p_withdrawn_on: input.withdrawnOn,
    p_mode: input.mode,
    p_current_period_action: input.currentPeriodAction,
    p_current_period_amount: requiresAmount ? amount : null,
    p_custom_future_targets: [],
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapWithdrawalError(error.message) }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function getEnrollmentFeeCoverage(input: {
  studentId: string
  cycleId: string
}): Promise<{ ok: true; covered: boolean } | { ok: false; message: string }> {
  if (!input.studentId || !input.cycleId) {
    return { ok: false, message: "No pudimos consultar la inscripción de esta matrícula." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("enrollment_fee_is_covered", {
    p_student_id: input.studentId,
    p_cycle_id: input.cycleId,
  })

  if (error || typeof data !== "boolean") {
    return { ok: false, message: "No pudimos consultar si la inscripción está cubierta. Inténtalo de nuevo." }
  }

  return { ok: true, covered: data }
}

export async function reactivateEnrollmentFinancial(input: {
  enrollmentId: string
  reactivatedOn: string
  groupId: string | null
  economicStartOn: string
  initialTuitionAmount: string | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | null
  enrollmentFeeAmount: string | null
  reason: string
}): Promise<EnrollmentMutationResult> {
  if (!isDate(input.reactivatedOn) || !isDate(input.economicStartOn)) {
    return { ok: false, message: "Captura fechas válidas para el reingreso." }
  }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo de la reactivación." }

  const initialTuitionAmount = cleanText(input.initialTuitionAmount)
  const enrollmentFeeAmount = cleanText(input.enrollmentFeeAmount)
  if (initialTuitionAmount && (!Number.isFinite(Number(initialTuitionAmount)) || Number(initialTuitionAmount) < 0)) {
    return { ok: false, message: "El monto del primer periodo debe ser válido." }
  }
  if (input.enrollmentFeeMode === "PROPORTIONAL" && (!enrollmentFeeAmount || !Number.isFinite(Number(enrollmentFeeAmount)) || Number(enrollmentFeeAmount) < 0)) {
    return { ok: false, message: "Captura un monto válido para la inscripción proporcional." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("reactivate_enrollment_financial", {
    p_enrollment_id: input.enrollmentId,
    p_reactivated_on: input.reactivatedOn,
    p_group_id: input.groupId,
    p_economic_start_on: input.economicStartOn,
    p_initial_tuition_amount: initialTuitionAmount,
    p_initial_tuition_due_date: null,
    p_enrollment_fee_mode: input.enrollmentFeeMode,
    p_enrollment_fee_amount: input.enrollmentFeeMode === "PROPORTIONAL" ? enrollmentFeeAmount : null,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapReactivationError(error.message) }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

function mapEnrollmentCreationError(message?: string) {
  const normalized = message?.toLowerCase() ?? ""
  let friendlyMessage = "No pudimos activar la matrícula. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("duplicate") || normalized.includes("already has an enrollment")) {
    friendlyMessage = "Este alumno ya tiene una matrícula en el ciclo seleccionado."
  }
  else if (normalized.includes("financial") || normalized.includes("tuition") || normalized.includes("plan")) {
    friendlyMessage = "No pudimos preparar la configuración financiera de la matrícula. Revisa la configuración e inténtalo de nuevo."
  }
  else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para crear esta matrícula."
  }

  if (process.env.NODE_ENV !== "production" && message) {
    return `${friendlyMessage} Detalle: ${message}`
  }

  return friendlyMessage
}

function validateMutationInput(effectiveOn: string, reason: string, action: "plan" | "group" | "classification") {
  if (!isDate(effectiveOn)) return "Captura una fecha efectiva válida."
  if (!reason.trim()) return `Indica el motivo del cambio de ${action}.`
  return null
}

function mapEnrollmentMutationError(message: string, action: "plan" | "group" | "classification") {
  const normalized = message.toLowerCase()
  let friendlyMessage = `No pudimos cambiar ${action === "plan" ? "el plan financiero" : action === "group" ? "el grupo" : "la clasificación"}. Revisa los datos e inténtalo de nuevo.`

  if (action === "plan") {
    if (normalized.includes("first tuition payment")) {
      friendlyMessage = "No se puede cambiar el plan porque ya existe un primer pago de colegiatura."
    } else if (normalized.includes("credit activity")) {
      friendlyMessage = "No se puede cambiar el plan porque ya existe actividad de crédito."
    } else if (normalized.includes("adjustment")) {
      friendlyMessage = "No se puede cambiar el plan porque existen ajustes en colegiaturas."
    } else if (normalized.includes("charge rules") || normalized.includes("proportional")) {
      friendlyMessage = "No se puede cambiar el plan porque existen reglas especiales que deben resolverse primero."
    } else if (normalized.includes("target plan") || normalized.includes("10 installments") || normalized.includes("different cycle") || normalized.includes("education level")) {
      friendlyMessage = "El plan seleccionado no es compatible con esta matrícula."
    }
  } else if (normalized.includes("already has requested") || normalized.includes("already assigned")) {
    friendlyMessage = `La matrícula ya tiene ${action === "group" ? "ese grupo" : "esa clasificación"}.`
  } else if (normalized.includes("does not belong") || normalized.includes("not found")) {
    friendlyMessage = `La opción seleccionada no es válida para esta matrícula.`
  }

  if (process.env.NODE_ENV !== "production") return `${friendlyMessage} Detalle: ${message}`
  return friendlyMessage
}

function mapWithdrawalError(message: string) {
  const normalized = message.toLowerCase()
  let friendlyMessage = "No pudimos completar la baja. Revisa los datos e inténtalo de nuevo."

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
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para registrar esta baja."
  }

  if (process.env.NODE_ENV !== "production") return `${friendlyMessage} Detalle: ${message}`
  return friendlyMessage
}

function mapReactivationError(message: string) {
  const normalized = message.toLowerCase()
  let friendlyMessage = "No pudimos reactivar la matrícula. Revisa los datos e inténtalo de nuevo."

  if (normalized.includes("only baja")) {
    friendlyMessage = "Solo una matrícula en baja puede reactivarse."
  } else if (normalized.includes("reactivated_on") || normalized.includes("economic_start_on")) {
    friendlyMessage = "Las fechas de reingreso deben estar dentro del ciclo y en el orden correcto."
  } else if (normalized.includes("group does not belong")) {
    friendlyMessage = "El grupo seleccionado no corresponde al ciclo y grado de esta matrícula."
  } else if (normalized.includes("initial tuition amount")) {
    friendlyMessage = "El monto del primer periodo solo aplica cuando el inicio económico cae dentro de un mes ya iniciado."
  } else if (normalized.includes("enrollment fee")) {
    friendlyMessage = "No pudimos preparar la inscripción para la reactivación. Revisa la configuración e inténtalo de nuevo."
  } else if (normalized.includes("tuition agreement") || normalized.includes("default 12-payment plan")) {
    friendlyMessage = "No existe una configuración financiera vigente para reactivar esta matrícula."
  } else if (normalized.includes("permission") || normalized.includes("authentication")) {
    friendlyMessage = "No tienes autorización para reactivar esta matrícula."
  }

  if (process.env.NODE_ENV !== "production") return `${friendlyMessage} Detalle: ${message}`
  return friendlyMessage
}

function validate(input: CreateEnrollmentInput) {
  if (!input.studentId || !input.cycleId || !input.gradeLevelId || !input.classificationId) {
    return "Selecciona al alumno, ciclo, grado y clasificación."
  }

  if (![input.activatedOn, input.economicStartOn].every(isDate)) {
    return "Captura fechas válidas para la matrícula."
  }

  if (input.classesStartOn && !isDate(input.classesStartOn)) {
    return "Captura una fecha de inicio de clases válida."
  }

  if (input.initialPeriodDueDate && !isDate(input.initialPeriodDueDate)) {
    return "Captura una fecha válida para el primer cobro."
  }

  if (input.initialPeriodAmount) {
    const amount = Number(input.initialPeriodAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      return "El importe del primer cobro debe ser un monto válido."
    }
  }

  if (!input.reason.trim()) return "Indica el motivo de la matrícula."

  return null
}

function cleanText(value: string | null) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : null
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
}
