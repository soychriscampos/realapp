"use server"

import { revalidatePath } from "next/cache"

import { mapDiscountError } from "@/lib/admin/discount-errors"
import { requireRole } from "@/lib/auth/require-role"

export type DiscountMutationResult = { ok: true } | { ok: false; message: string }

export type SchoolCycleMutationResult = { ok: true } | { ok: false; message: string }

export type SchoolCycleGroupMutationResult = { ok: true } | { ok: false; message: string }

export async function createSchoolCycle(input: {
  code: string
  name: string
  startsOn: string
  endsOn: string
}): Promise<SchoolCycleMutationResult> {
  const validationMessage = validateCycleInput(input)
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("create_school_cycle", {
    p_code: input.code.trim(),
    p_name: input.name.trim(),
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
  })

  if (error) return { ok: false, message: mapSchoolCycleError(error.message) }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function updateSchoolCycle(input: {
  cycleId: string
  code: string
  name: string
  startsOn: string
  endsOn: string
}): Promise<SchoolCycleMutationResult> {
  const validationMessage = validateCycleInput(input)
  if (validationMessage || !input.cycleId) return { ok: false, message: validationMessage ?? "No encontramos el ciclo seleccionado." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("update_school_cycle", {
    p_cycle_id: input.cycleId,
    p_code: input.code.trim(),
    p_name: input.name.trim(),
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
  })

  if (error) return { ok: false, message: mapSchoolCycleError(error.message) }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function activateSchoolCycle(input: { cycleId: string }): Promise<SchoolCycleMutationResult> {
  if (!input.cycleId) return { ok: false, message: "No encontramos el ciclo seleccionado." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("activate_school_cycle", { p_cycle_id: input.cycleId })

  if (error) return { ok: false, message: mapSchoolCycleError(error.message) }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function setSchoolCycleRate(input: {
  cycleId: string
  educationLevelId: string
  conceptCode: "TUITION" | "ENROLLMENT_FEE"
  amount: string
  effectiveOn: string
  reason: string
}): Promise<SchoolCycleMutationResult> {
  const amount = Number(input.amount)
  if (!input.cycleId || !input.educationLevelId) return { ok: false, message: "No encontramos el ciclo o nivel seleccionado." }
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: "El monto debe ser cero o mayor." }
  if (!isDate(input.effectiveOn)) return { ok: false, message: "Captura una fecha efectiva válida." }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo del cambio." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: concept, error: conceptError } = await supabase
    .from("financial_concepts")
    .select("id")
    .eq("code", input.conceptCode)
    .eq("is_active", true)
    .maybeSingle()

  if (conceptError || !concept?.id) return { ok: false, message: "No encontramos el concepto financiero seleccionado." }

  const { error } = await supabase.rpc("set_base_rate", {
    p_cycle_id: input.cycleId,
    p_education_level_id: input.educationLevelId,
    p_financial_concept_id: concept.id,
    p_amount: amount,
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapSchoolCycleRateError(error.message) }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function createSchoolCycleGroup(input: {
  cycleId: string
  gradeLevelId: string
  code: string
  name: string
}): Promise<SchoolCycleGroupMutationResult> {
  const validationMessage = validateGroupInput(input)
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.from("groups").insert({
    cycle_id: input.cycleId,
    grade_level_id: input.gradeLevelId,
    code: input.code.trim(),
    name: input.name.trim(),
    created_by: userId,
  })

  if (error) return { ok: false, message: mapSchoolCycleGroupError(error.message, "create") }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function updateSchoolCycleGroup(input: {
  groupId: string
  cycleId: string
  gradeLevelId: string
  code: string
  name: string
}): Promise<SchoolCycleGroupMutationResult> {
  const validationMessage = validateGroupInput(input)
  if (validationMessage || !input.groupId) return { ok: false, message: validationMessage ?? "No encontramos el grupo seleccionado." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase
    .from("groups")
    .update({ code: input.code.trim(), name: input.name.trim(), updated_at: new Date().toISOString() })
    .eq("id", input.groupId)
    .eq("cycle_id", input.cycleId)
    .eq("grade_level_id", input.gradeLevelId)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, message: mapSchoolCycleGroupError(error.message, "update") }
  if (!data) return { ok: false, message: "No encontramos el grupo seleccionado." }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function setSchoolCycleGroupActive(input: {
  groupId: string
  cycleId: string
  gradeLevelId: string
  isActive: boolean
}): Promise<SchoolCycleGroupMutationResult> {
  if (!input.groupId || !input.cycleId || !input.gradeLevelId) return { ok: false, message: "No encontramos el grupo seleccionado." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase
    .from("groups")
    .update({ is_active: input.isActive, updated_at: new Date().toISOString() })
    .eq("id", input.groupId)
    .eq("cycle_id", input.cycleId)
    .eq("grade_level_id", input.gradeLevelId)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, message: mapSchoolCycleGroupError(error.message, "status") }
  if (!data) return { ok: false, message: "No encontramos el grupo seleccionado." }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

function validateCycleInput(input: { code: string; name: string; startsOn: string; endsOn: string }) {
  if (!input.code.trim()) return "Indica un código para el ciclo escolar."
  if (!input.name.trim()) return "Indica un nombre para el ciclo escolar."
  if (!isDate(input.startsOn) || !isDate(input.endsOn)) return "Captura fechas válidas."
  if (input.endsOn < input.startsOn) return "La fecha de fin debe ser posterior o igual a la fecha de inicio."
  return null
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function mapSchoolCycleError(message: string) {
  if (message.includes("already exists")) return "Ya existe un ciclo escolar con ese código."
  if (message.includes("already active")) return "No se puede activar: ya existe otro ciclo escolar activo."
  if (message.includes("preparation")) return "Solo se puede activar un ciclo en preparación."
  if (message.includes("not found")) return "No encontramos el ciclo escolar seleccionado."
  if (message.includes("end date")) return "La fecha de fin debe ser posterior o igual a la fecha de inicio."
  if (message.includes("permission")) return "No tienes permiso para administrar ciclos escolares."
  return "No pudimos actualizar el ciclo escolar. Inténtalo de nuevo."
}

function mapSchoolCycleRateError(message: string) {
  if (message.includes("amount must be")) return "El monto debe ser cero o mayor."
  if (message.includes("effective_on must belong")) return "La fecha efectiva debe estar dentro del ciclo escolar."
  if (message.includes("Reason is required")) return "Indica el motivo del cambio."
  if (message.includes("future base-rate")) return "Ya existe una tarifa programada después de esa fecha."
  if (message.includes("already has this amount")) return "La tarifa ya tiene ese monto."
  if (message.includes("already starts")) return "Ya existe una tarifa con esa fecha efectiva."
  if (message.includes("permission")) return "No tienes permiso para configurar tarifas."
  return "No pudimos actualizar la tarifa. Inténtalo de nuevo."
}

function validateGroupInput(input: { cycleId: string; gradeLevelId: string; code: string; name: string }) {
  if (!input.cycleId || !input.gradeLevelId) return "Selecciona un ciclo y un grado."
  if (!input.code.trim()) return "Indica un código para el grupo."
  if (!input.name.trim()) return "Indica un nombre para el grupo."
  return null
}

function mapSchoolCycleGroupError(message: string, context: "create" | "update" | "status") {
  if (message.includes("duplicate") || message.includes("unique")) return "Ya existe un grupo con ese código para este grado y ciclo."
  if (message.includes("permission") || message.includes("row-level security")) return "No tienes permiso para administrar grupos."
  return context === "status" ? "No pudimos actualizar el estado del grupo." : context === "update" ? "No pudimos actualizar el grupo." : "No pudimos crear el grupo."
}

export async function createTuitionDiscountCategory(input: {
  cycleId: string
  name: string
  discountType: "PERCENTAGE" | "FIXED_AMOUNT"
  value: string
  effectiveOn: string
  reason: string
}): Promise<DiscountMutationResult> {
  const validationMessage = validateInput(input.value, input.effectiveOn, input.reason, input.discountType, "create")
  if (validationMessage || !input.cycleId || !input.name.trim()) {
    return { ok: false, message: validationMessage ?? "Indica un nombre para la categoría." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("create_tuition_discount_category", {
    p_cycle_id: input.cycleId,
    p_name: input.name.trim(),
    p_discount_type: input.discountType,
    p_value: input.value.trim(),
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapDiscountError(error.message, "create") }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function changeTuitionDiscountCategoryVersion(input: {
  categoryId: string
  discountType: "PERCENTAGE" | "FIXED_AMOUNT"
  value: string
  effectiveOn: string
  reason: string
  currentVersionValidFrom: string | null
}): Promise<DiscountMutationResult> {
  const validationMessage = validateInput(input.value, input.effectiveOn, input.reason, input.discountType, "change")
  if (validationMessage || !input.categoryId) {
    return { ok: false, message: validationMessage ?? "No encontramos la categoría seleccionada." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const rpcName = input.currentVersionValidFrom === input.effectiveOn
    ? "correct_tuition_discount_category_version"
    : "change_tuition_discount_category_version"
  const { error } = await supabase.rpc(rpcName, {
    p_category_id: input.categoryId,
    p_value: input.value.trim(),
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapDiscountError(error.message, "change") }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function renameTuitionDiscountCategory(input: {
  categoryId: string
  name: string
  reason: string
}): Promise<DiscountMutationResult> {
  if (!input.categoryId || !input.name.trim()) return { ok: false, message: "Indica un nombre nuevo para la categoría." }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo del cambio de nombre." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("rename_tuition_discount_category", {
    p_category_id: input.categoryId,
    p_name: input.name.trim(),
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapDiscountError(error.message, "rename") }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

export async function setTuitionDiscountCategoryActive(input: {
  categoryId: string
  isActive: boolean
  reason: string
}): Promise<DiscountMutationResult> {
  if (!input.categoryId) return { ok: false, message: "No encontramos la categoría seleccionada." }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo del cambio de estado." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("set_tuition_discount_category_active", {
    p_category_id: input.categoryId,
    p_is_active: input.isActive,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapDiscountError(error.message, "status") }
  revalidatePath("/admin/configuracion")
  return { ok: true }
}

function validateInput(
  value: string,
  effectiveOn: string,
  reason: string,
  discountType: "PERCENTAGE" | "FIXED_AMOUNT",
  context: "create" | "change"
) {
  const numericValue = Number(value)
  if (!value.trim() || !Number.isFinite(numericValue) || numericValue <= 0) return "El valor debe ser mayor que cero."
  if (discountType === "PERCENTAGE" && numericValue > 100) return "El porcentaje no puede ser mayor a 100%."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) return "Captura una fecha efectiva válida."
  if (!reason.trim()) return context === "create" ? "Indica el motivo de la categoría." : "Indica el motivo del cambio."
  return null
}
