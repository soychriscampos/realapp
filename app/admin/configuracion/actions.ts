"use server"

import { revalidatePath } from "next/cache"

import { mapDiscountError } from "@/lib/admin/discount-errors"
import { requireRole } from "@/lib/auth/require-role"

export type DiscountMutationResult = { ok: true } | { ok: false; message: string }

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
