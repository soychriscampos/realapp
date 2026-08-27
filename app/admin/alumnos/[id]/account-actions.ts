"use server"

import { getStudentAccount, getStudentPaymentDetails } from "@/lib/admin/student-account"
import { getStudentCatalogs, getStudentDetail } from "@/lib/admin/students"
import { buildAccountStatementPdfData } from "@/lib/documents/financial/account-statement-data"
import { generateAccountStatementPdf } from "@/lib/documents/financial/account-statement"
import { getStudentEmailRecipients } from "@/lib/email/recipients"
import { resend } from "@/lib/email/resend"
import { requireRole } from "@/lib/auth/require-role"

export type SendAccountStatementEmailResult =
  | { ok: true; recipientCount: number }
  | { ok: false; reason: "NO_RECIPIENTS" | "CONFIGURATION" | "ERROR"; message: string }

export async function sendAccountStatementEmail(
  studentId: string
): Promise<SendAccountStatementEmailResult> {
  if (!studentId) {
    return { ok: false, reason: "ERROR", message: "No fue posible enviar el estado de cuenta." }
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim()
  if (!from) {
    return { ok: false, reason: "CONFIGURATION", message: "El correo no está configurado." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)
  if (catalogsError) {
    return { ok: false, reason: "ERROR", message: "No fue posible preparar el estado de cuenta." }
  }

  const [{ data: student, error: studentError }, accountResult, recipientsResult] = await Promise.all([
    getStudentDetail(supabase, studentId, catalogs?.operationalCycle?.id),
    getStudentAccount(supabase, studentId),
    getStudentEmailRecipients(supabase, studentId),
  ])

  if (studentError || recipientsResult.error) {
    return { ok: false, reason: "ERROR", message: "No fue posible preparar el envío." }
  }

  if (!student) {
    return { ok: false, reason: "ERROR", message: "Alumno no encontrado." }
  }

  if (accountResult.error || !accountResult.data) {
    return { ok: false, reason: "ERROR", message: "No fue posible obtener el estado de cuenta." }
  }

  if (!recipientsResult.data.length) {
    return { ok: false, reason: "NO_RECIPIENTS", message: "No hay correos disponibles para este alumno." }
  }

  const paymentIds = accountResult.data.movements
    .filter((movement) => movement.movementType === "PAYMENT")
    .map((movement) => movement.id)
  const paymentDetailsResult = await getStudentPaymentDetails(supabase, studentId, paymentIds)

  if (paymentDetailsResult.error) {
    return { ok: false, reason: "ERROR", message: "No fue posible preparar el estado de cuenta." }
  }

  const data = buildAccountStatementPdfData(
    student,
    accountResult.data,
    paymentDetailsResult.data,
    new Date()
  )

  try {
    const pdf = await generateAccountStatementPdf(data)
    const filename = `estado-de-cuenta-${safeFilename(student.fullName)}.pdf`
    const { error } = await resend.emails.send({
      from,
      to: recipientsResult.data.map((recipient) => recipient.email),
      subject: `Estado de cuenta — ${student.fullName}`,
      text: `Se adjunta el estado de cuenta del alumno ${student.fullName}.`,
      attachments: [{
        filename,
        content: pdf,
        contentType: "application/pdf",
      }],
    })

    if (error) {
      console.error("send_account_statement_email failed", {
        message: error.message,
        studentId,
      })
      return { ok: false, reason: "ERROR", message: "No fue posible enviar el estado de cuenta." }
    }

    return { ok: true, recipientCount: recipientsResult.data.length }
  } catch (error) {
    console.error("send_account_statement_email failed", { error, studentId })
    return { ok: false, reason: "ERROR", message: "No fue posible enviar el estado de cuenta." }
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
