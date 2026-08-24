"use server"

import { revalidatePath } from "next/cache"

import { mapEnrollmentError } from "@/lib/admin/enrollment-errors"
import { mapTuitionDiscountAssignmentError } from "@/lib/admin/tuition-discount-assignment-errors"
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
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | null
  enrollmentFeeAmount: string | null
  reason: string
}

export type CreateEnrollmentResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; message: string; stage?: "enrollment" | "agreement" | "financials" | "activation" }

export type EnrollmentMutationResult =
  | { ok: true }
  | { ok: false; message: string }

type BulkEnrollmentItem = {
  studentId: string
  cycleId: string
  gradeLevelId: string
  classificationId: string
  groupId: string
  activatedOn: string
  classesStartOn: string | null
  economicStartOn: string
  initialPeriodAmount: string | null
  enrollmentFeeMode: "FULL" | null
  reason: string
}

export type BulkEnrollmentResult = {
  studentId: string
  success: boolean
  message: string | null
}

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
      p_enrollment_fee_mode: input.enrollmentFeeMode,
      p_enrollment_fee_amount: input.enrollmentFeeMode === "PROPORTIONAL"
        ? cleanText(input.enrollmentFeeAmount)
        : null,
      p_reason: input.reason.trim(),
    }
  )

  if (error || typeof enrollmentId !== "string" || !enrollmentId) {
    return {
      ok: false,
      stage: "enrollment",
      message: mapEnrollmentError(error?.message, "activation"),
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

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "plan") }
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

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "group") }
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

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "classification") }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function setEnrollmentTuitionDiscount(input: {
  enrollmentId: string
  studentId: string
  categoryId: string
  effectiveOn: string
  effectMode: "CURRENT" | "NEXT" | "PROPORTIONAL"
  currentPeriodAmount: string | null
  reason: string
}): Promise<EnrollmentMutationResult> {
  if (!input.enrollmentId || !input.studentId || !input.categoryId) return { ok: false, message: "Selecciona una categoría de descuento." }
  if (!isDate(input.effectiveOn)) return { ok: false, message: "Captura una fecha efectiva válida." }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo del descuento." }

  const currentPeriodAmount = cleanText(input.currentPeriodAmount)
  if (input.effectMode === "PROPORTIONAL" && (!currentPeriodAmount || !Number.isFinite(Number(currentPeriodAmount)) || Number(currentPeriodAmount) < 0)) {
    return { ok: false, message: "Captura un monto final válido para el periodo actual." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("set_enrollment_tuition_discount", {
    p_enrollment_id: input.enrollmentId,
    p_category_id: input.categoryId,
    p_effective_on: input.effectiveOn,
    p_effect_mode: input.effectMode,
    p_current_period_amount: input.effectMode === "PROPORTIONAL" ? currentPeriodAmount : null,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapTuitionDiscountAssignmentError(error.message) }
  revalidatePath("/admin/matricula")
  revalidatePath(`/admin/alumnos/${input.studentId}`)
  revalidatePath(`/admin/alumnos/${input.studentId}/cuenta`)
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

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "withdrawal") }
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

export async function getBulkEnrollmentFeeCoverage(input: {
  studentIds: string[]
  cycleId: string
}): Promise<{ ok: true; coverage: Record<string, boolean> } | { ok: false; message: string }> {
  const studentIds = [...new Set(input.studentIds.filter(Boolean))]
  if (!studentIds.length || !input.cycleId) {
    return { ok: false, message: "Selecciona al menos un alumno para continuar." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const results = await Promise.all(studentIds.map(async (studentId) => {
    const { data, error } = await supabase.rpc("enrollment_fee_is_covered", {
      p_student_id: studentId,
      p_cycle_id: input.cycleId,
    })
    return { studentId, covered: data, error }
  }))

  if (results.some((result) => result.error || typeof result.covered !== "boolean")) {
    return { ok: false, message: "No pudimos consultar si las inscripciones están cubiertas. Inténtalo de nuevo." }
  }

  return {
    ok: true,
    coverage: Object.fromEntries(results.map((result) => [result.studentId, result.covered as boolean])),
  }
}

export async function bulkCreateAndActivateEnrollments(input: {
  items: BulkEnrollmentItem[]
}): Promise<{ ok: true; results: BulkEnrollmentResult[] } | { ok: false; message: string }> {
  if (!input.items.length) return { ok: false, message: "Selecciona al menos un alumno para activar." }

  for (const item of input.items) {
    if (!item.studentId || !item.cycleId || !item.gradeLevelId || !item.classificationId || !item.groupId) {
      return { ok: false, message: "Completa grado, grupo y clasificación para todos los alumnos seleccionados." }
    }
    if (![item.activatedOn, item.economicStartOn].every(isDate)) {
      return { ok: false, message: "Captura fechas válidas para la activación." }
    }
    if (item.classesStartOn && !isDate(item.classesStartOn)) {
      return { ok: false, message: "Captura una fecha válida de inicio de clases." }
    }
    if (!item.reason.trim()) return { ok: false, message: "Indica el motivo de la activación." }
    if (item.initialPeriodAmount && (!Number.isFinite(Number(item.initialPeriodAmount)) || Number(item.initialPeriodAmount) < 0)) {
      return { ok: false, message: "El importe del primer periodo debe ser válido." }
    }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("bulk_create_and_activate_enrollments", {
    p_items: input.items.map((item) => ({
      student_id: item.studentId,
      cycle_id: item.cycleId,
      grade_level_id: item.gradeLevelId,
      classification_id: item.classificationId,
      group_id: item.groupId,
      activated_on: item.activatedOn,
      classes_start_on: cleanText(item.classesStartOn),
      economic_start_on: item.economicStartOn,
      initial_period_amount: cleanText(item.initialPeriodAmount),
      initial_period_due_date: null,
      enrollment_fee_mode: item.enrollmentFeeMode,
      enrollment_fee_amount: null,
      reason: item.reason.trim(),
    })),
  })

  if (error || !Array.isArray(data)) {
    return { ok: false, message: mapEnrollmentError(error?.message, "activation") }
  }

  const results = data.flatMap((item): BulkEnrollmentResult[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const studentId = typeof row.student_id === "string" ? row.student_id : ""
    const success = row.success === true
    if (!studentId) return []
    return [{
      studentId,
      success,
      message: success ? null : mapEnrollmentError(typeof row.error === "string" ? row.error : undefined, "activation"),
    }]
  })

  if (results.length !== input.items.length) {
    return { ok: false, message: "No pudimos interpretar el resultado de la activación masiva. Inténtalo de nuevo." }
  }

  revalidatePath("/admin/matricula")
  for (const item of input.items) revalidatePath(`/admin/alumnos/${item.studentId}`)

  return { ok: true, results }
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

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "reactivation") }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

function validateMutationInput(effectiveOn: string, reason: string, action: "plan" | "group" | "classification") {
  if (!isDate(effectiveOn)) return "Captura una fecha efectiva válida."
  if (!reason.trim()) return `Indica el motivo del cambio de ${action}.`
  return null
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

  if (input.enrollmentFeeMode === "PROPORTIONAL") {
    const amount = Number(input.enrollmentFeeAmount)
    if (!input.enrollmentFeeAmount?.trim() || !Number.isFinite(amount) || amount < 0) {
      return "El importe de inscripción proporcional debe ser un monto válido."
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
