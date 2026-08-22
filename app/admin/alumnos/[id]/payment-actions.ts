"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth/require-role"

export type RegisterPaymentInput = {
  studentId: string
  receivedAt: string
  amount: string
  paymentMethodId: string
  receivedByStaffId: string
  bankReference: string | null
  notes: string | null
  receiptVisibleNote: string | null
  allocations: Array<{ charge_id: string; amount: string }>
  allocationOverrideReason: string | null
}

export type RegisterPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; message: string; refreshCharges?: boolean }

export async function registerPayment(
  input: RegisterPaymentInput
): Promise<RegisterPaymentResult> {
  const parsedAmount = Number(input.amount)

  if (
    !input.studentId ||
    !input.paymentMethodId ||
    !input.receivedByStaffId ||
    !input.receivedAt ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0
  ) {
    return { ok: false, message: "Revisa los datos obligatorios del pago." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("register_payment", {
    p_student_id: input.studentId,
    p_received_at: input.receivedAt,
    p_amount: input.amount,
    p_payment_method_id: input.paymentMethodId,
    p_received_by_staff_id: input.receivedByStaffId,
    p_bank_reference: cleanText(input.bankReference),
    p_notes: cleanText(input.notes),
    p_receipt_visible_note: cleanText(input.receiptVisibleNote),
    p_allocations: input.allocations,
    p_allocation_override_reason: cleanText(input.allocationOverrideReason),
  })

  if (error) {
    console.error("register_payment failed", {
      code: error.code,
      message: error.message,
      studentId: input.studentId,
    })

    return mapRegisterPaymentError(error.message)
  }

  if (typeof data !== "string" || !data) {
    return {
      ok: false,
      message: "No pudimos confirmar el registro del pago. Inténtalo de nuevo.",
    }
  }

  revalidatePath(`/admin/alumnos/${input.studentId}`)
  revalidatePath(`/admin/alumnos/${input.studentId}/cuenta`)

  return { ok: true, paymentId: data }
}

function cleanText(value: string | null) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : null
}

function mapRegisterPaymentError(message: string): RegisterPaymentResult {
  const normalized = message.toLowerCase()

  if (normalized.includes("another receiver") || normalized.includes("receiver staff")) {
    return {
      ok: false,
      message: "El receptor seleccionado no está autorizado para este registro.",
    }
  }

  if (normalized.includes("payment method") || normalized.includes("description is required")) {
    return {
      ok: false,
      message: "El método de pago cambió o requiere información adicional.",
    }
  }

  if (
    normalized.includes("outstanding balance") ||
    normalized.includes("does not belong") ||
    normalized.includes("active charge")
  ) {
    return {
      ok: false,
      message: "Los saldos cambiaron. Revisa nuevamente la distribución del pago.",
      refreshCharges: true,
    }
  }

  if (normalized.includes("allocation") || normalized.includes("amount")) {
    return {
      ok: false,
      message: "La distribución o el monto del pago no es válido.",
    }
  }

  if (normalized.includes("permission") || normalized.includes("authentication")) {
    return {
      ok: false,
      message: "No tienes autorización para registrar este pago.",
    }
  }

  return {
    ok: false,
    message: "No pudimos registrar el pago. Revisa los datos e inténtalo de nuevo.",
  }
}
