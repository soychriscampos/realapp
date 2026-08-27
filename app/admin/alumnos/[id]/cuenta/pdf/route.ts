import { NextResponse } from "next/server"

import { getStudentAccount, getStudentPaymentDetails } from "@/lib/admin/student-account"
import { getStudentCatalogs, getStudentDetail } from "@/lib/admin/students"
import { buildAccountStatementPdfData } from "@/lib/documents/financial/account-statement-data"
import { generateAccountStatementPdf } from "@/lib/documents/financial/account-statement"
import { requireRole } from "@/lib/auth/require-role"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError) {
    return errorResponse("No fue posible obtener el estado de cuenta.", 500)
  }

  const [{ data: student, error: studentError }, accountResult] = await Promise.all([
    getStudentDetail(supabase, id, catalogs?.operationalCycle?.id),
    getStudentAccount(supabase, id),
  ])

  if (studentError) {
    return errorResponse("No fue posible obtener el estado de cuenta.", 500)
  }

  if (!student) {
    return errorResponse("Alumno no encontrado.", 404)
  }

  if (accountResult.error || !accountResult.data) {
    return errorResponse("No fue posible obtener el estado de cuenta.", 500)
  }

  const paymentIds = accountResult.data.movements
    .filter((movement) => movement.movementType === "PAYMENT")
    .map((movement) => movement.id)
  const paymentDetailsResult = await getStudentPaymentDetails(supabase, id, paymentIds)

  if (paymentDetailsResult.error) {
    return errorResponse("No fue posible obtener el estado de cuenta.", 500)
  }

  const data = buildAccountStatementPdfData(
    student,
    accountResult.data,
    paymentDetailsResult.data,
    new Date()
  )

  try {
    const pdf = await generateAccountStatementPdf(data)
    const body = new ArrayBuffer(pdf.byteLength)
    new Uint8Array(body).set(pdf)
    const filename = `estado-de-cuenta-${safeFilename(student.fullName)}.pdf`

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return errorResponse("No fue posible generar el estado de cuenta.", 500)
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
