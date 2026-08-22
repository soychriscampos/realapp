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

export type UpdatePaymentMetadataInput = {
  studentId: string
  paymentId: string
  patch: Record<string, string | null>
  reason: string
}

export type CorrectPaymentAllocationsInput = {
  studentId: string
  paymentId: string
  allocations: Array<{ charge_id: string; amount: string }>
  reason: string
}

export type ReversePaymentInput = {
  studentId: string
  paymentId: string
  reason: string
}

export type PaymentManagementResult =
  | { ok: true }
  | { ok: false; message: string; refreshAccount?: boolean }

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

export async function updatePaymentMetadata(
  input: UpdatePaymentMetadataInput
): Promise<PaymentManagementResult> {
  const patch = Object.fromEntries(
    Object.entries(input.patch).map(([key, value]) => [key, cleanText(value)])
  )

  if (!input.paymentId || !input.studentId || !input.reason.trim() || !Object.keys(patch).length) {
    return { ok: false, message: "Agrega un cambio y el motivo de la corrección." }
  }

  return runPaymentManagementRpc(
    "update_payment_metadata",
    {
      p_payment_id: input.paymentId,
      p_patch: patch,
      p_reason: input.reason.trim(),
    },
    input.studentId,
    "metadata"
  )
}

export async function correctPaymentAllocations(
  input: CorrectPaymentAllocationsInput
): Promise<PaymentManagementResult> {
  if (!input.paymentId || !input.studentId || !input.reason.trim() || !input.allocations.length) {
    return { ok: false, message: "Define la distribución y explica el motivo de la corrección." }
  }

  return runPaymentManagementRpc(
    "correct_payment_allocations",
    {
      p_payment_id: input.paymentId,
      p_allocations: input.allocations,
      p_reason: input.reason.trim(),
    },
    input.studentId,
    "allocations"
  )
}

export async function reversePayment(
  input: ReversePaymentInput
): Promise<PaymentManagementResult> {
  if (!input.paymentId || !input.studentId || !input.reason.trim()) {
    return { ok: false, message: "Indica el motivo de la reversión." }
  }

  return runPaymentManagementRpc(
    "reverse_payment",
    {
      p_payment_id: input.paymentId,
      p_reason: input.reason.trim(),
    },
    input.studentId,
    "reverse"
  )
}

async function runPaymentManagementRpc(
  rpc: "update_payment_metadata" | "correct_payment_allocations" | "reverse_payment",
  args: Record<string, unknown>,
  studentId: string,
  operation: "metadata" | "allocations" | "reverse"
): Promise<PaymentManagementResult> {
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc(rpc, args)

  if (error) {
    console.error(`${rpc} failed`, { code: error.code, message: error.message, studentId })
    return mapPaymentManagementError(error.message, operation)
  }

  revalidatePath(`/admin/alumnos/${studentId}`)
  revalidatePath(`/admin/alumnos/${studentId}/cuenta`)

  return { ok: true }
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

function mapPaymentManagementError(
  message: string,
  operation: "metadata" | "allocations" | "reverse"
): PaymentManagementResult {
  const normalized = message.toLowerCase()

  if (normalized.includes("insufficient permission") || normalized.includes("authentication")) {
    return { ok: false, message: "No tienes autorización para gestionar este pago." }
  }

  if (normalized.includes("not found")) {
    return { ok: false, message: "El pago ya no está disponible.", refreshAccount: true }
  }

  if (normalized.includes("confirmed") || normalized.includes("already been reversed") || normalized.includes("refund")) {
    return {
      ok: false,
      message: "El estado de este pago cambió. Actualiza la cuenta antes de continuar.",
      refreshAccount: true,
    }
  }

  if (normalized.includes("available amount") || normalized.includes("allocated total") || normalized.includes("allocation")) {
    return {
      ok: false,
      message: "Los saldos cambiaron. Revisa nuevamente la distribución.",
      refreshAccount: true,
    }
  }

  if (normalized.includes("reason") || normalized.includes("patch") || normalized.includes("description")) {
    return { ok: false, message: "Revisa los campos y el motivo de la corrección." }
  }

  const fallback = operation === "reverse"
    ? "No pudimos revertir el pago. Inténtalo de nuevo."
    : "No pudimos guardar la corrección. Inténtalo de nuevo."

  return { ok: false, message: fallback }
}
