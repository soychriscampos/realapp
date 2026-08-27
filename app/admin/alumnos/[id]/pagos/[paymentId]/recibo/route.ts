import { NextResponse } from "next/server"

import { getStudentChargeBalances, getStudentPaymentDetails } from "@/lib/admin/student-account"
import { getStudentDetail } from "@/lib/admin/students"
import {
  generatePaymentReceiptPdf,
  type PaymentReceiptPdfData,
} from "@/lib/documents/financial/payment-receipt"
import { requireRole } from "@/lib/auth/require-role"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id: studentId, paymentId } = await params
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])

  try {
    const [{ data: student, error: studentError }, paymentResult, chargesResult] = await Promise.all([
      getStudentDetail(supabase, studentId, undefined),
      getStudentPaymentDetails(supabase, studentId, [paymentId]),
      getStudentChargeBalances(supabase, studentId),
    ])

    if (studentError) {
      return errorResponse("No fue posible obtener el alumno.", 500)
    }

    if (!student) {
      return errorResponse("Alumno no encontrado.", 404)
    }

    if (paymentResult.error) {
      return errorResponse("No fue posible obtener el pago.", 500)
    }

    if (chargesResult.error) {
      return errorResponse("No fue posible obtener las aplicaciones del pago.", 500)
    }

    const payment = paymentResult.data.find((item) => item.id === paymentId)
    if (!payment) {
      return errorResponse("Pago no encontrado.", 404)
    }

    const chargeById = new Map(chargesResult.data.map((charge) => [charge.id, charge]))
    const data: PaymentReceiptPdfData = {
      student: {
        fullName: student.fullName,
        studentCode: student.studentCode,
      },
      payment: {
        ...payment,
        allocations: payment.allocations.map((allocation) => {
          const charge = chargeById.get(allocation.chargeId)
          return {
            conceptName: charge?.conceptName ?? "Cargo no disponible",
            cycleCode: charge?.cycleCode ?? "",
            amount: allocation.amount,
          }
        }),
      },
    }

    const pdf = await generatePaymentReceiptPdf(data)
    const filename = `recibo-pago-${safeFilename(student.fullName)}-${safeFilename(paymentId).slice(0, 8)}.pdf`
    const body = new ArrayBuffer(pdf.byteLength)
    new Uint8Array(body).set(pdf)

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return errorResponse("No fue posible generar el recibo.", 500)
  }
}

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  return normalized || "alumno"
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
