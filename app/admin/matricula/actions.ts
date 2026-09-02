"use server"

import { revalidatePath } from "next/cache"

import { mapEnrollmentError } from "@/lib/admin/enrollment-errors"
import { mapPreregistrationCampaignError, mapPreregistrationIntakeError, mapPreregistrationRegistrationError, mapRetroactivePreregistrationError } from "@/lib/admin/preregistration-campaign-errors"
import { getStudentChargeBalances, type StudentChargeBalance } from "@/lib/admin/student-account"
import { getPaymentFormContext, type PaymentFormContext } from "@/lib/admin/payments"
import { getTuitionDiscountCategories, type TuitionDiscountCategory } from "@/lib/admin/discount-categories"
import { mapTuitionDiscountAssignmentError } from "@/lib/admin/tuition-discount-assignment-errors"
import { buildStudentNameSearchPattern } from "@/lib/admin/students"
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
  discountCategoryId: string | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | "NO_FEE" | null
  enrollmentFeeAmount: string | null
  reason: string
}

export type CreateEnrollmentResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; message: string; stage?: "enrollment" | "agreement" | "financials" | "activation" }

export async function adjustEnrollmentFee(input: { enrollmentId: string; chargeId: string | null; targetAmount: string; dueDate: string; reason: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  const amount = Number(input.targetAmount)
  if (!input.enrollmentId || !Number.isFinite(amount) || amount < 0) return { ok: false, message: "Captura un monto válido para la inscripción." }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo de la corrección." }
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = input.chargeId
    ? await supabase.rpc("adjust_charge", { p_charge_id: input.chargeId, p_target_amount: amount, p_adjustment_type: "CORRECTION", p_reason: input.reason.trim() })
    : await supabase.rpc("create_enrollment_fee_charge", { p_enrollment_id: input.enrollmentId, p_amount: amount, p_due_date: input.dueDate, p_reason: input.reason.trim() })
  if (error) return { ok: false, message: "No pudimos corregir el monto de inscripción. Verifica que el nuevo monto no sea menor a lo ya pagado." }
  revalidatePath("/admin/alumnos", "layout")
  return { ok: true }
}

export type CreateNewStudentEnrollmentInput = {
  studentFullName: string
  studentSex: "H" | "M"
  studentBirthDate: string | null
  contacts: Array<{
    guardian_id?: string
    full_name: string
    relationship: string
    phone: string
    email: string
  }>
  cycleId: string
  gradeLevelId: string
  classificationId: string
  discountCategoryId: string | null
  groupId: string | null
  activatedOn: string
  classesStartOn: string | null
  economicStartOn: string
  initialPeriodAmount: string | null
  initialPeriodDueDate: string | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | "NO_FEE" | null
  enrollmentFeeAmount: string | null
  reason: string
}

export type CreateNewStudentEnrollmentResult =
  | {
      ok: true
      studentId: string
      enrollmentId: string
      charges: StudentChargeBalance[]
      paymentContext: PaymentFormContext | null
      canReceiveForOthers: boolean
    }
  | { ok: false; message: string }

export type NewEnrollmentFinancialOptions = {
  baseAmount: number | null
  discountCategories: TuitionDiscountCategory[]
}

export type EnrollmentMutationResult =
  | { ok: true }
  | { ok: false; message: string }

export async function getNewEnrollmentFinancialOptions(input: {
  cycleId: string
  educationLevelId: string
  effectiveOn: string
}): Promise<{ ok: true; data: NewEnrollmentFinancialOptions } | { ok: false; message: string }> {
  if (!input.cycleId || !input.educationLevelId || !isDate(input.effectiveOn)) {
    return { ok: true, data: { baseAmount: null, discountCategories: [] } }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: concept, error: conceptError } = await supabase
    .from("financial_concepts")
    .select("id")
    .eq("code", "TUITION")
    .maybeSingle()

  if (conceptError || !concept?.id) return { ok: false, message: "No existe el concepto de colegiatura configurado." }

  const { data: rates, error: ratesError } = await supabase
    .from("base_rates")
    .select("amount, valid_from, valid_until")
    .eq("cycle_id", input.cycleId)
    .eq("education_level_id", input.educationLevelId)
    .eq("financial_concept_id", concept.id)
    .lte("valid_from", input.effectiveOn)
    .or(`valid_until.is.null,valid_until.gte.${input.effectiveOn}`)
    .order("valid_from", { ascending: false })
    .limit(1)

  if (ratesError) return { ok: false, message: "No pudimos consultar la colegiatura base configurada." }

  const amount = rates?.[0] ? Number(rates[0].amount) : Number.NaN
  const categoriesResult = await getTuitionDiscountCategories(supabase, input.cycleId)
  if (categoriesResult.error) return { ok: false, message: "No pudimos consultar los beneficios de colegiatura." }

  const categories = categoriesResult.data.filter((category) => {
    if (!category.isActive) return false
    return category.versions.some((version) =>
      version.validFrom <= input.effectiveOn && (!version.validUntil || version.validUntil >= input.effectiveOn)
    )
  })

  return {
    ok: true,
    data: {
      baseAmount: Number.isFinite(amount) ? amount : null,
      discountCategories: categories,
    },
  }
}

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
  initialPeriodDueDate: string | null
  discountCategoryId: string | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | "NO_FEE" | null
  enrollmentFeeAmount: string | null
  reason: string
}

export type BulkEnrollmentResult = {
  studentId: string
  success: boolean
  message: string | null
}

export type NoContinuaResult = {
  studentId: string
  enrollmentId: string | null
  success: boolean
  alreadyProcessed: boolean
  message: string | null
}

type BulkTuitionDiscountItem = {
  enrollmentId: string
  studentId: string
  categoryId: string
  currentPeriodAmount: string | null
}

export type BulkTuitionDiscountResult = {
  studentId: string
  success: boolean
  message: string | null
}

export type ResolvePreregistrationInput = {
  preregistrationId: string
  studentId: string
  classificationId: string
  groupId: string
  activatedOn: string
  classesStartOn: string | null
  economicStartOn: string
  initialPeriodAmount: string | null
  initialPeriodDueDate: string | null
  discountCategoryId: string | null
  enrollmentFeeMode: "FULL" | "PROPORTIONAL" | "NO_FEE" | null
  enrollmentFeeAmount: string | null
  reason: string
}

export type CreatePreregistrationCampaignInput = {
  targetCycleId: string
  educationLevelId: string | null
  name: string
  startsOn: string
  endsOn: string
  price: string
}

export type EligiblePreregistrationStudent = {
  id: string
  fullName: string
  studentCode: string | null
}

export type RegisterPreregistrationInCampaignInput = {
  campaignId: string
  studentId: string
  targetGradeLevelId: string
  notes: string | null
}

export type PreregistrationIntakeStudent = {
  id: string
  fullName: string
  studentCode: string | null
}

export type PreregistrationIntakeContact = {
  guardianId: string | null
  fullName: string
  phone: string
  email: string
  viaEmail?: boolean
  relationship: string
}

export type PreregistrationIntakeStudentDetail = PreregistrationIntakeStudent & {
  contacts: PreregistrationIntakeContact[]
  enrollmentHistory: Array<{ cycleId: string; cycleName: string; status: string }>
  latestEnrollment: {
    status: string
    enrolledOn: string
    cycle: { id: string; name: string; startsOn: string }
    educationLevel: { id: string; name: string }
    gradeLevel: { id: string; name: string; sortOrder: number }
    group: { id: string; name: string; code: string } | null
  } | null
  suggestedDestination: {
    cycleId: string
    educationLevelId: string
    gradeLevelId: string
    groupId: string | null
  } | null
  hasEmailRecipient: boolean
}

export type CreatePreregistrationIntakeInput = {
  preregisteredOn: string
  studentId: string | null
  studentFullName: string | null
  targetCycleId: string
  targetEducationLevelId: string
  targetGradeLevelId: string
  targetGroupId: string
  campaignId: string
  contacts: PreregistrationIntakeContact[]
  notes: string | null
}

export type PreregistrationPaymentContext = {
  studentId: string
  studentFullName: string
  charge: StudentChargeBalance
}

export type RetroactivePreregistrationStudent = {
  id: string
  fullName: string
  studentCode: string | null
  enrollment: {
    enrolledOn: string
    gradeLevelId: string
    groupId: string | null
  }
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
      p_discount_category_id: cleanText(input.discountCategoryId),
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

export async function createNewStudentEnrollment(
  input: CreateNewStudentEnrollmentInput
): Promise<CreateNewStudentEnrollmentResult> {
  if (!input.studentFullName.trim()) return { ok: false, message: "Indica el nombre completo del alumno." }
  if (!/[HM]/.test(input.studentSex)) return { ok: false, message: "Selecciona el sexo del alumno." }
  if (input.studentBirthDate && !isDate(input.studentBirthDate)) return { ok: false, message: "Captura una fecha de nacimiento válida." }
  if (input.contacts.length > 2) return { ok: false, message: "Agrega un máximo de dos contactos." }
  if (input.contacts.some((contact) => !contact.full_name.trim() || !contact.relationship.trim() || !contact.phone.trim())) {
    return { ok: false, message: "Completa nombre, parentesco y teléfono de cada contacto agregado." }
  }

  const validationMessage = validate({
    studentId: "new-student",
    cycleId: input.cycleId,
    gradeLevelId: input.gradeLevelId,
    groupId: input.groupId,
    classificationId: input.classificationId,
    classesStartOn: input.classesStartOn,
    activatedOn: input.activatedOn,
    economicStartOn: input.economicStartOn,
    initialPeriodAmount: input.initialPeriodAmount,
    initialPeriodDueDate: input.initialPeriodDueDate,
    discountCategoryId: input.discountCategoryId,
    enrollmentFeeMode: input.enrollmentFeeMode,
    enrollmentFeeAmount: input.enrollmentFeeAmount,
    reason: input.reason,
  })
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase, roles, userId } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("create_new_student_enrollment", {
    p_student_full_name: input.studentFullName.trim(),
    p_student_sex: input.studentSex,
    p_student_birth_date: cleanText(input.studentBirthDate),
    p_contacts: input.contacts.map((contact) => ({
      guardian_id: contact.guardian_id ?? null,
      full_name: contact.full_name.trim(),
      relationship: contact.relationship.trim(),
      phone: contact.phone.trim(),
      email: contact.email.trim(),
    })),
    p_cycle_id: input.cycleId,
    p_grade_level_id: input.gradeLevelId,
    p_classification_id: input.classificationId,
    p_discount_category_id: cleanText(input.discountCategoryId),
    p_group_id: cleanText(input.groupId),
    p_activated_on: input.activatedOn,
    p_classes_start_on: cleanText(input.classesStartOn),
    p_economic_start_on: input.economicStartOn,
    p_initial_period_amount: cleanText(input.initialPeriodAmount),
    p_initial_period_due_date: cleanText(input.initialPeriodDueDate),
    p_enrollment_fee_mode: input.enrollmentFeeMode,
    p_enrollment_fee_amount: input.enrollmentFeeMode === "PROPORTIONAL" ? cleanText(input.enrollmentFeeAmount) : null,
    p_reason: input.reason.trim(),
  })

  const created = data as { student_id?: unknown; enrollment_id?: unknown } | null
  const studentId = typeof created?.student_id === "string" ? created.student_id : ""
  const enrollmentId = typeof created?.enrollment_id === "string" ? created.enrollment_id : ""
  if (error || !studentId || !enrollmentId) {
    return { ok: false, message: mapEnrollmentError(error?.message, "activation") }
  }

  const [chargesResult, paymentContextResult] = await Promise.all([
    getStudentChargeBalances(supabase, studentId),
    getPaymentFormContext(supabase, userId),
  ])
  if (chargesResult.error) return { ok: false, message: "El alumno fue creado, pero no pudimos consultar sus cargos pendientes. Revisa su cuenta." }

  revalidatePath("/admin/matricula")
  revalidatePath(`/admin/alumnos/${studentId}`)
  return {
    ok: true,
    studentId,
    enrollmentId,
    charges: chargesResult.data.filter((charge) => Number(charge.outstandingAmount) > 0),
    paymentContext: paymentContextResult.data,
    canReceiveForOthers: roles.includes("MASTER"),
  }
}

export async function resolvePreregistrationToEnrollment(
  input: ResolvePreregistrationInput
): Promise<CreateEnrollmentResult> {
  if (!input.preregistrationId || !input.studentId || !input.classificationId || !input.groupId) {
    return { ok: false, message: "Selecciona grupo y clasificación para activar la matrícula." }
  }
  if (![input.activatedOn, input.economicStartOn].every(isDate)) {
    return { ok: false, message: "Captura fechas válidas para la matrícula." }
  }
  if (input.classesStartOn && !isDate(input.classesStartOn)) {
    return { ok: false, message: "Captura una fecha válida de inicio de clases." }
  }
  if (input.initialPeriodDueDate && !isDate(input.initialPeriodDueDate)) {
    return { ok: false, message: "Captura una fecha válida para el primer cobro." }
  }
  if (input.initialPeriodAmount && (!Number.isFinite(Number(input.initialPeriodAmount)) || Number(input.initialPeriodAmount) < 0)) {
    return { ok: false, message: "El importe del primer cobro debe ser un monto válido." }
  }
  if (input.enrollmentFeeMode === "PROPORTIONAL" && (!input.enrollmentFeeAmount?.trim() || !Number.isFinite(Number(input.enrollmentFeeAmount)) || Number(input.enrollmentFeeAmount) <= 0)) {
    return { ok: false, message: "El importe de inscripción proporcional debe ser un monto válido." }
  }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo de la matrícula." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: enrollmentId, error } = await supabase.rpc("resolve_preregistration_to_enrollment", {
    p_preregistration_id: input.preregistrationId,
    p_classification_id: input.classificationId,
    p_group_id: input.groupId,
    p_activated_on: input.activatedOn,
    p_classes_start_on: cleanText(input.classesStartOn),
    p_economic_start_on: input.economicStartOn,
    p_initial_period_amount: cleanText(input.initialPeriodAmount),
    p_initial_period_due_date: cleanText(input.initialPeriodDueDate),
    p_enrollment_fee_mode: input.enrollmentFeeMode,
    p_enrollment_fee_amount: input.enrollmentFeeMode === "PROPORTIONAL" ? cleanText(input.enrollmentFeeAmount) : null,
    p_reason: input.reason.trim(),
    p_discount_category_id: cleanText(input.discountCategoryId),
  })

  if (error || typeof enrollmentId !== "string" || !enrollmentId) {
    return { ok: false, stage: "activation", message: mapEnrollmentError(error?.message, "preregistration") }
  }

  revalidatePath("/admin/matricula")
  revalidatePath(`/admin/alumnos/${input.studentId}`)
  return { ok: true, enrollmentId }
}

export async function createPreregistrationCampaign(
  input: CreatePreregistrationCampaignInput
): Promise<EnrollmentMutationResult> {
  if (!input.targetCycleId) return { ok: false, message: "Selecciona un ciclo destino válido." }
  if (!input.name.trim()) return { ok: false, message: "Indica un nombre para la campaña." }
  if (![input.startsOn, input.endsOn].every(isDate)) return { ok: false, message: "Captura fechas válidas para la campaña." }
  if (input.endsOn < input.startsOn) return { ok: false, message: "La fecha de fin debe ser igual o posterior a la fecha de inicio." }
  if (!input.price.trim() || !Number.isFinite(Number(input.price)) || Number(input.price) < 0) return { ok: false, message: "El precio debe ser cero o mayor." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: enrollmentFeeConcept, error: conceptError } = await supabase
    .from("financial_concepts")
    .select("id")
    .eq("code", "ENROLLMENT_FEE")
    .eq("is_active", true)
    .maybeSingle()

  if (conceptError || !enrollmentFeeConcept?.id) {
    return { ok: false, message: "No existe un concepto activo de inscripción configurado." }
  }

  const { error } = await supabase.rpc("create_preregistration_campaign", {
    p_target_cycle_id: input.targetCycleId,
    p_education_level_id: cleanText(input.educationLevelId),
    p_name: input.name.trim(),
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_price: input.price.trim(),
    p_covered_concept_id: enrollmentFeeConcept.id,
    p_allows_partial_payments: false,
    p_non_continuation_policy: "MANUAL_REVIEW",
    p_status: "ACTIVE",
  })

  if (error) return { ok: false, message: mapPreregistrationCampaignError(error.message) }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function searchEligiblePreregistrationStudents(input: {
  campaignId: string
  term: string
}): Promise<{ data: EligiblePreregistrationStudent[]; error: boolean }> {
  const term = input.term.trim()
  if (!input.campaignId || term.length < 2) return { data: [], error: false }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: campaign, error: campaignError } = await supabase
    .from("preregistration_campaigns")
    .select("target_cycle_id")
    .eq("id", input.campaignId)
    .maybeSingle()

  if (campaignError || !campaign?.target_cycle_id) return { data: [], error: true }

  const [nameResult, codeResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .filter("full_name", "imatch", buildStudentNameSearchPattern(term))
      .order("full_name", { ascending: true })
      .limit(8),
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .ilike("student_code", `%${term}%`)
      .order("full_name", { ascending: true })
      .limit(8),
  ])

  if (nameResult.error || codeResult.error) return { data: [], error: true }

  const candidates = [...(nameResult.data ?? []), ...(codeResult.data ?? [])]
    .filter((student, index, students) => students.findIndex((item) => item.id === student.id) === index)
    .slice(0, 8)
  const studentIds = candidates.map((student) => student.id)
  if (!studentIds.length) return { data: [], error: false }

  const [preregistrationResult, enrollmentResult] = await Promise.all([
    supabase
      .from("preregistrations")
      .select("student_id")
      .eq("target_cycle_id", campaign.target_cycle_id)
      .in("student_id", studentIds),
    supabase
      .from("enrollments")
      .select("student_id")
      .eq("cycle_id", campaign.target_cycle_id)
      .in("student_id", studentIds),
  ])

  if (preregistrationResult.error || enrollmentResult.error) return { data: [], error: true }

  const unavailableStudentIds = new Set([
    ...(preregistrationResult.data ?? []).map((item) => item.student_id),
    ...(enrollmentResult.data ?? []).map((item) => item.student_id),
  ])

  return {
    data: candidates
      .filter((student) => !unavailableStudentIds.has(student.id))
      .map((student) => ({ id: student.id, fullName: student.full_name, studentCode: student.student_code })),
    error: false,
  }
}

export async function registerPreregistrationInCampaign(
  input: RegisterPreregistrationInCampaignInput
): Promise<EnrollmentMutationResult> {
  if (!input.campaignId || !input.studentId) return { ok: false, message: "Selecciona un alumno para la campaña." }
  if (!input.targetGradeLevelId) return { ok: false, message: "Selecciona un grado destino válido." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("register_preregistration_in_campaign", {
    p_campaign_id: input.campaignId,
    p_student_id: input.studentId,
    p_target_grade_level_id: input.targetGradeLevelId,
    p_notes: cleanText(input.notes),
  })

  if (error) return { ok: false, message: mapPreregistrationRegistrationError(error.message) }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function searchPreregistrationIntakeStudents(term: string): Promise<{
  data: PreregistrationIntakeStudent[]
  error: boolean
}> {
  const query = term.trim()
  if (query.length < 2) return { data: [], error: false }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const [nameResult, codeResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .filter("full_name", "imatch", buildStudentNameSearchPattern(query))
      .order("full_name", { ascending: true })
      .limit(8),
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .ilike("student_code", `%${query}%`)
      .order("full_name", { ascending: true })
      .limit(8),
  ])

  if (nameResult.error || codeResult.error) return { data: [], error: true }

  return {
    data: [...(nameResult.data ?? []), ...(codeResult.data ?? [])]
      .filter((student, index, students) => students.findIndex((item) => item.id === student.id) === index)
      .slice(0, 8)
      .map((student) => ({ id: student.id, fullName: student.full_name, studentCode: student.student_code })),
    error: false,
  }
}

export async function getPreregistrationIntakeStudent(studentId: string): Promise<{
  data: PreregistrationIntakeStudentDetail | null
  error: boolean
}> {
  if (!studentId) return { data: null, error: false }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const [studentResult, contactsResult, enrollmentResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_guardians")
    .select("guardian_id, relationship, priority, via_email, guardians!inner(id, full_name, phone, email)")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .order("priority")
      .limit(2),
    supabase
      .from("enrollments")
      .select("status, enrolled_on, cycle_id, school_cycles!inner(id, name, starts_on), grade_levels!inner(id, name, education_level_id, sort_order, education_levels!inner(id, name, sort_order)), groups(id, name, code)")
      .eq("student_id", studentId)
      .order("enrolled_on", { ascending: false })
      .limit(12),
  ])

  if (studentResult.error || contactsResult.error || enrollmentResult.error || !studentResult.data) {
    return { data: null, error: Boolean(studentResult.error || contactsResult.error || enrollmentResult.error) }
  }

  const latestEnrollmentRow = enrollmentResult.data?.[0]
  const latestCycle = latestEnrollmentRow && (Array.isArray(latestEnrollmentRow.school_cycles) ? latestEnrollmentRow.school_cycles[0] : latestEnrollmentRow.school_cycles)
  const latestGrade = latestEnrollmentRow && (Array.isArray(latestEnrollmentRow.grade_levels) ? latestEnrollmentRow.grade_levels[0] : latestEnrollmentRow.grade_levels)
  const latestLevel = latestGrade && (Array.isArray(latestGrade.education_levels) ? latestGrade.education_levels[0] : latestGrade.education_levels)
  const latestGroup = latestEnrollmentRow && (Array.isArray(latestEnrollmentRow.groups) ? latestEnrollmentRow.groups[0] : latestEnrollmentRow.groups)

  let suggestedDestination: PreregistrationIntakeStudentDetail["suggestedDestination"] = null
  if (latestCycle && latestGrade && latestLevel) {
    const nextCycleResult = await supabase
      .from("school_cycles")
      .select("id, name, starts_on")
      .gt("starts_on", latestCycle.starts_on)
      .order("starts_on", { ascending: true })
      .limit(1)
      .maybeSingle()
    const nextLevelResult = await supabase
      .from("education_levels")
      .select("id, name, sort_order")
      .eq("is_active", true)
      .gt("sort_order", latestLevel.sort_order)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle()
    const nextGradeResult = nextLevelResult.data
      ? await supabase
        .from("grade_levels")
        .select("id, name, sort_order")
        .eq("education_level_id", nextLevelResult.data.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle()
      : { data: null, error: null }

    const nextCycle = nextCycleResult.data
    const nextGrade = nextGradeResult.data
    if (!nextCycleResult.error && !nextLevelResult.error && !nextGradeResult.error && nextCycle && nextLevelResult.data && nextGrade) {
      const { data: nextGroups } = await supabase
        .from("groups")
        .select("id, code")
        .eq("cycle_id", nextCycle.id)
        .eq("grade_level_id", nextGrade.id)
        .eq("is_active", true)
        .order("code", { ascending: true })

      const matchingGroup = latestGroup && nextGroups?.find((group) => group.code === latestGroup.code)
      const groupId = nextGroups?.length === 1 ? nextGroups[0].id : matchingGroup?.id ?? null
      suggestedDestination = {
        cycleId: nextCycle.id,
        educationLevelId: nextLevelResult.data.id,
        gradeLevelId: nextGrade.id,
        groupId,
      }
    }
  }

  return {
    data: {
      id: studentResult.data.id,
      fullName: studentResult.data.full_name,
      studentCode: studentResult.data.student_code,
      contacts: (contactsResult.data ?? []).flatMap((contact) => {
        const guardian = Array.isArray(contact.guardians) ? contact.guardians[0] : contact.guardians
        if (!guardian) return []
        return [{
          guardianId: contact.guardian_id,
          fullName: guardian.full_name,
          phone: guardian.phone ?? "",
          email: guardian.email ?? "",
          viaEmail: contact.via_email === true,
          relationship: contact.relationship,
        }]
      }),
      enrollmentHistory: (enrollmentResult.data ?? []).flatMap((enrollment) => {
        const cycle = Array.isArray(enrollment.school_cycles) ? enrollment.school_cycles[0] : enrollment.school_cycles
        return cycle ? [{ cycleId: cycle.id, cycleName: cycle.name, status: enrollment.status }] : []
      }),
      latestEnrollment: latestCycle && latestGrade && latestLevel
        ? {
            status: latestEnrollmentRow.status,
            enrolledOn: latestEnrollmentRow.enrolled_on,
            cycle: { id: latestCycle.id, name: latestCycle.name, startsOn: latestCycle.starts_on },
            educationLevel: { id: latestGrade.education_level_id, name: latestLevel.name },
            gradeLevel: { id: latestGrade.id, name: latestGrade.name, sortOrder: latestGrade.sort_order },
            group: latestGroup
              ? { id: latestGroup.id, name: latestGroup.name, code: latestGroup.code }
              : null,
          }
        : null,
      suggestedDestination,
      hasEmailRecipient: (contactsResult.data ?? []).some((contact) => {
        const guardian = Array.isArray(contact.guardians) ? contact.guardians[0] : contact.guardians
        return contact.via_email === true && typeof guardian?.email === "string" && guardian.email.trim().length > 0
      }),
    },
    error: false,
  }
}

export async function createPreregistrationIntake(
  input: CreatePreregistrationIntakeInput
): Promise<{ ok: true; preregistrationId: string; historical: boolean; historicalChargeStatus: "PENDING" | "COVERED" | "UNLINKED" | "REVIEW" | null; payment: PreregistrationPaymentContext | null } | { ok: false; message: string }> {
  if (!isDate(input.preregisteredOn)) return { ok: false, message: "Captura una fecha de preinscripción válida." }
  if (!input.studentId && !input.studentFullName?.trim()) return { ok: false, message: "Captura el nombre completo del alumno nuevo." }
  if (!input.targetCycleId || !input.targetEducationLevelId || !input.targetGradeLevelId || !input.targetGroupId || !input.campaignId) {
    return { ok: false, message: "Selecciona ciclo, nivel, grado, grupo y campaña." }
  }
  if (!input.contacts.length) return { ok: false, message: "Agrega al menos un contacto." }
  if (input.contacts.length > 2) return { ok: false, message: "Solo puedes registrar un máximo de dos contactos." }
  if (input.contacts.some((contact) => !contact.fullName.trim() || !contact.phone.trim())) {
    return { ok: false, message: "Captura el nombre y teléfono de cada contacto." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: preregistrationId, error } = await supabase.rpc("create_preregistration_intake", {
    p_preregistered_on: input.preregisteredOn,
    p_student_id: input.studentId,
    p_student_full_name: input.studentId ? null : cleanText(input.studentFullName),
    p_target_cycle_id: input.targetCycleId,
    p_target_education_level_id: input.targetEducationLevelId,
    p_target_grade_level_id: input.targetGradeLevelId,
    p_target_group_id: input.targetGroupId,
    p_campaign_id: input.campaignId,
    p_contacts: input.contacts.map((contact) => ({
      guardian_id: contact.guardianId,
      via_email: contact.viaEmail ?? null,
      full_name: contact.fullName.trim(),
      phone: contact.phone.trim(),
      email: cleanText(contact.email),
      relationship: cleanText(contact.relationship),
    })),
    p_notes: cleanText(input.notes),
  })

  if (error || typeof preregistrationId !== "string" || !preregistrationId) {
    return { ok: false, message: mapPreregistrationIntakeError(error?.message) }
  }

  const { data: preregistration } = await supabase
    .from("preregistrations")
    .select("student_id, charge_id, status, students!inner(full_name)")
    .eq("id", preregistrationId)
    .maybeSingle()
  const student = preregistration?.students
  const studentRecord = Array.isArray(student) ? student[0] : student
  const historical = preregistration?.status === "RESOLVED"
  const chargeBalances = preregistration?.student_id && preregistration.charge_id
    ? await getStudentChargeBalances(supabase, preregistration.student_id)
    : null
  const charge = preregistration?.charge_id
    ? chargeBalances?.data.find((item) => item.id === preregistration.charge_id) ?? null
    : null
  const historicalChargeStatus = historical
    ? !preregistration?.charge_id
      ? "UNLINKED" as const
      : chargeBalances?.error
        ? "REVIEW" as const
        : charge && Number(charge.outstandingAmount) > 0
        ? "PENDING" as const
        : "COVERED" as const
    : null

  revalidatePath("/admin/matricula")
  if (input.studentId) revalidatePath(`/admin/alumnos/${input.studentId}`)
  return {
    ok: true,
    preregistrationId,
    historical,
    historicalChargeStatus,
    payment: preregistration?.student_id && studentRecord && charge && (!historical || historicalChargeStatus === "PENDING")
      ? { studentId: preregistration.student_id, studentFullName: studentRecord.full_name, charge }
      : null,
  }
}

export async function searchRetroactivePreregistrationStudents(input: {
  campaignId: string
  term: string
}): Promise<{ data: RetroactivePreregistrationStudent[]; error: boolean }> {
  const term = input.term.trim()
  if (!input.campaignId || term.length < 2) return { data: [], error: false }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: campaign, error: campaignError } = await supabase
    .from("preregistration_campaigns")
    .select("target_cycle_id")
    .eq("id", input.campaignId)
    .maybeSingle()
  if (campaignError || !campaign?.target_cycle_id) return { data: [], error: true }

  const [nameResult, codeResult] = await Promise.all([
    supabase.from("students").select("id, full_name, student_code").filter("full_name", "imatch", buildStudentNameSearchPattern(term)).order("full_name").limit(8),
    supabase.from("students").select("id, full_name, student_code").ilike("student_code", `%${term}%`).order("full_name").limit(8),
  ])
  if (nameResult.error || codeResult.error) return { data: [], error: true }

  const candidates = [...(nameResult.data ?? []), ...(codeResult.data ?? [])]
    .filter((student, index, students) => students.findIndex((item) => item.id === student.id) === index)
    .slice(0, 8)
  const studentIds = candidates.map((student) => student.id)
  if (!studentIds.length) return { data: [], error: false }

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("student_id, enrolled_on, grade_level_id, group_id")
    .eq("cycle_id", campaign.target_cycle_id)
    .in("student_id", studentIds)
  if (enrollmentError) return { data: [], error: true }

  const enrollmentsByStudent = new Map((enrollments ?? []).map((enrollment) => [enrollment.student_id, enrollment]))
  return {
    data: candidates.flatMap((student) => {
      const enrollment = enrollmentsByStudent.get(student.id)
      if (!enrollment) return []
      return [{
        id: student.id,
        fullName: student.full_name,
        studentCode: student.student_code,
        enrollment: {
          enrolledOn: enrollment.enrolled_on,
          gradeLevelId: enrollment.grade_level_id,
          groupId: enrollment.group_id,
        },
      }]
    }),
    error: false,
  }
}

export async function createRetroactivePreregistration(input: {
  studentId: string
  campaignId: string
  preregisteredOn: string
  targetGradeLevelId: string
  targetGroupId: string
  notes: string | null
}): Promise<{ ok: true; linkedCharge: boolean } | { ok: false; message: string }> {
  if (!input.studentId || !input.campaignId || !input.targetGradeLevelId || !input.targetGroupId || !isDate(input.preregisteredOn)) {
    return { ok: false, message: "Completa alumno, campaña, fecha, grado y grupo." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data: preregistrationId, error } = await supabase.rpc("create_retroactive_preregistration", {
    p_student_id: input.studentId,
    p_campaign_id: input.campaignId,
    p_preregistered_on: input.preregisteredOn,
    p_target_grade_level_id: input.targetGradeLevelId,
    p_target_group_id: input.targetGroupId,
    p_notes: cleanText(input.notes),
  })
  if (error || typeof preregistrationId !== "string" || !preregistrationId) {
    return { ok: false, message: mapRetroactivePreregistrationError(error?.message) }
  }

  const { data: preregistration } = await supabase
    .from("preregistrations")
    .select("charge_id")
    .eq("id", preregistrationId)
    .maybeSingle()
  revalidatePath("/admin/matricula")
  revalidatePath(`/admin/alumnos/${input.studentId}`)
  return { ok: true, linkedCharge: Boolean(preregistration?.charge_id) }
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

export async function changeEnrollmentGrade(input: {
  enrollmentId: string
  gradeLevelId: string
  groupId: string | null
  effectiveOn: string
  reason: string
}): Promise<EnrollmentMutationResult> {
  if (!input.gradeLevelId) return { ok: false, message: "Selecciona un grado nuevo." }
  const validationMessage = validateMutationInput(input.effectiveOn, input.reason, "grade")
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("change_enrollment_grade", {
    p_enrollment_id: input.enrollmentId,
    p_grade_level_id: input.gradeLevelId,
    p_group_id: input.groupId,
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "grade") }
  revalidatePath("/admin/matricula")
  revalidatePath("/admin/alumnos")
  return { ok: true }
}

export async function correctEnrollmentAcademicDates(input: {
  enrollmentId: string
  enrolledOn: string
  classesStartOn: string | null
  effectiveOn: string
  reason: string
}): Promise<EnrollmentMutationResult> {
  if (!isDate(input.enrolledOn) || (input.classesStartOn !== null && input.classesStartOn !== "" && !isDate(input.classesStartOn))) {
    return { ok: false, message: "Captura fechas académicas válidas." }
  }
  const validationMessage = validateMutationInput(input.effectiveOn, input.reason, "dates")
  if (validationMessage) return { ok: false, message: validationMessage }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("correct_enrollment_academic_dates", {
    p_enrollment_id: input.enrollmentId,
    p_enrolled_on: input.enrolledOn,
    p_classes_start_on: input.classesStartOn || null,
    p_effective_on: input.effectiveOn,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "dates") }
  revalidatePath("/admin/matricula")
  revalidatePath("/admin/alumnos")
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

export async function bulkSetEnrollmentTuitionDiscount(input: {
  items: BulkTuitionDiscountItem[]
  effectiveOn: string
  effectMode: "CURRENT" | "NEXT" | "PROPORTIONAL"
  reason: string
}): Promise<{ ok: true; results: BulkTuitionDiscountResult[] } | { ok: false; message: string }> {
  if (!input.items.length) return { ok: false, message: "Selecciona al menos un alumno para asignar el descuento." }
  if (!isDate(input.effectiveOn)) return { ok: false, message: "Captura una fecha efectiva válida." }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo del descuento." }

  for (const item of input.items) {
    if (!item.enrollmentId || !item.studentId || !item.categoryId) {
      return { ok: false, message: "Selecciona una categoría para todos los alumnos." }
    }
    if (input.effectMode === "PROPORTIONAL") {
      const amount = cleanText(item.currentPeriodAmount)
      if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
        return { ok: false, message: "Captura un monto final válido para todos los alumnos seleccionados." }
      }
    }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const results = await Promise.all(input.items.map(async (item): Promise<BulkTuitionDiscountResult> => {
    try {
      const { error } = await supabase.rpc("set_enrollment_tuition_discount", {
        p_enrollment_id: item.enrollmentId,
        p_category_id: item.categoryId,
        p_effective_on: input.effectiveOn,
        p_effect_mode: input.effectMode,
        p_current_period_amount: input.effectMode === "PROPORTIONAL" ? cleanText(item.currentPeriodAmount) : null,
        p_reason: input.reason.trim(),
      })

      return {
        studentId: item.studentId,
        success: !error,
        message: error ? mapTuitionDiscountAssignmentError(error.message) : null,
      }
    } catch {
      return {
        studentId: item.studentId,
        success: false,
        message: "No pudimos asignar el descuento. Inténtalo de nuevo.",
      }
    }
  }))

  revalidatePath("/admin/matricula")
  for (const result of results.filter((result) => result.success)) {
    revalidatePath(`/admin/alumnos/${result.studentId}`)
    revalidatePath(`/admin/alumnos/${result.studentId}/cuenta`)
  }

  return { ok: true, results }
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

export async function finalizeActiveEnrollments(input: {
  cycleId: string
  effectiveOn: string
}): Promise<{ ok: true; finalizedCount: number } | { ok: false; message: string }> {
  if (!input.cycleId || !isDate(input.effectiveOn)) {
    return { ok: false, message: "Selecciona una fecha efectiva válida." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("finalize_active_enrollments", {
    p_cycle_id: input.cycleId,
    p_effective_on: input.effectiveOn,
  })

  if (error || typeof data !== "number") {
    return { ok: false, message: mapEnrollmentError(error?.message, "finalization") }
  }

  revalidatePath("/admin/matricula")
  return { ok: true, finalizedCount: data }
}

export async function finalizeSelectedEnrollments(input: {
  enrollmentIds: string[]
  effectiveOn: string
}): Promise<{ ok: true; finalizedCount: number } | { ok: false; message: string }> {
  const enrollmentIds = [...new Set(input.enrollmentIds.filter(Boolean))]
  if (!enrollmentIds.length || !isDate(input.effectiveOn)) {
    return { ok: false, message: "Selecciona matrículas y una fecha efectiva válida." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("finalize_selected_enrollments", {
    p_enrollment_ids: enrollmentIds,
    p_effective_on: input.effectiveOn,
  })

  if (error || typeof data !== "number") {
    return { ok: false, message: mapEnrollmentError(error?.message, "finalization") }
  }

  revalidatePath("/admin/matricula")
  return { ok: true, finalizedCount: data }
}

export async function graduateSelectedEnrollments(input: {
  enrollmentIds: string[]
  effectiveOn: string
}): Promise<{ ok: true; graduatedCount: number } | { ok: false; message: string }> {
  const enrollmentIds = [...new Set(input.enrollmentIds.filter(Boolean))]
  if (!enrollmentIds.length || !isDate(input.effectiveOn)) {
    return { ok: false, message: "Selecciona matrículas y una fecha efectiva válida." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("graduate_selected_enrollments", {
    p_enrollment_ids: enrollmentIds,
    p_effective_on: input.effectiveOn,
  })

  if (error || typeof data !== "number") {
    return { ok: false, message: mapEnrollmentError(error?.message, "graduation") }
  }

  revalidatePath("/admin/matricula")
  return { ok: true, graduatedCount: data }
}

export async function graduateEnrollment(input: {
  enrollmentId: string
  effectiveOn: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.enrollmentId || !isDate(input.effectiveOn)) {
    return { ok: false, message: "Selecciona una fecha efectiva válida." }
  }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("graduate_enrollment", {
    p_enrollment_id: input.enrollmentId,
    p_effective_on: input.effectiveOn,
  })

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "graduation") }
  revalidatePath("/admin/matricula")
  return { ok: true }
}

export async function markEnrollmentsNoContinua(input: {
  sourceEnrollmentIds: string[]
  targetCycleId: string
}): Promise<{ ok: true; results: NoContinuaResult[] } | { ok: false; message: string }> {
  const sourceEnrollmentIds = [...new Set(input.sourceEnrollmentIds.filter(Boolean))]
  if (!sourceEnrollmentIds.length || !input.targetCycleId) {
    return { ok: false, message: "Selecciona alumnos y un ciclo destino válido." }
  }
  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { data, error } = await supabase.rpc("mark_enrollments_no_continua", {
    p_source_enrollment_ids: sourceEnrollmentIds,
    p_target_cycle_id: input.targetCycleId,
  })
  if (error || !Array.isArray(data)) return { ok: false, message: mapEnrollmentError(error?.message, "no_continua") }

  const results = data.flatMap((item): NoContinuaResult[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const studentId = typeof row.student_id === "string" ? row.student_id : ""
    if (!studentId) return []
    return [{
      studentId,
      enrollmentId: typeof row.enrollment_id === "string" ? row.enrollment_id : null,
      success: row.success === true,
      alreadyProcessed: row.already_processed === true,
      message: row.success === true ? null : mapEnrollmentError(typeof row.error === "string" ? row.error : undefined, "no_continua"),
    }]
  })
  if (results.length !== sourceEnrollmentIds.length) return { ok: false, message: "No pudimos interpretar el resultado. Actualiza la pantalla e inténtalo de nuevo." }
  revalidatePath("/admin/matricula")
  for (const result of results.filter((item) => item.success)) revalidatePath(`/admin/alumnos/${result.studentId}`)
  return { ok: true, results }
}

export async function closeSchoolCycle(input: {
  cycleId: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.cycleId) return { ok: false, message: "Selecciona un ciclo escolar válido." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("close_school_cycle", {
    p_cycle_id: input.cycleId,
  })

  if (error) return { ok: false, message: mapEnrollmentError(error.message, "cycle_closure") }
  revalidatePath("/admin/matricula")
  revalidatePath("/admin/configuracion")
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
    if (item.initialPeriodDueDate && !isDate(item.initialPeriodDueDate)) {
      return { ok: false, message: "Captura una fecha válida para el primer cobro." }
    }
    if (!item.reason.trim()) return { ok: false, message: "Indica el motivo de la activación." }
    if (item.initialPeriodAmount && (!Number.isFinite(Number(item.initialPeriodAmount)) || Number(item.initialPeriodAmount) < 0)) {
      return { ok: false, message: "El importe del primer periodo debe ser válido." }
    }
    if (item.enrollmentFeeMode === "PROPORTIONAL" && (!item.enrollmentFeeAmount?.trim() || !Number.isFinite(Number(item.enrollmentFeeAmount)) || Number(item.enrollmentFeeAmount) <= 0)) {
      return { ok: false, message: "El importe de inscripción proporcional debe ser mayor que cero." }
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
      initial_period_due_date: cleanText(item.initialPeriodDueDate),
      enrollment_fee_mode: item.enrollmentFeeMode,
      enrollment_fee_amount: item.enrollmentFeeMode === "PROPORTIONAL" ? cleanText(item.enrollmentFeeAmount) : null,
      discount_category_id: cleanText(item.discountCategoryId),
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

export async function regularizeEnrollmentFinancialStart(input: {
  enrollmentId: string
  studentId: string
  economicStartOn: string
  initialPeriodAmount: string | null
  initialPeriodDueDate: string | null
  reason: string
}): Promise<EnrollmentMutationResult> {
  if (!input.enrollmentId || !input.studentId || !isDate(input.economicStartOn)) {
    return { ok: false, message: "Captura una fecha de inicio económico válida." }
  }
  if (!input.reason.trim()) return { ok: false, message: "Indica el motivo de la regularización." }

  const amount = cleanText(input.initialPeriodAmount)
  const dueDate = cleanText(input.initialPeriodDueDate)
  if (amount && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    return { ok: false, message: "El importe del primer periodo debe ser válido." }
  }
  if (dueDate && !isDate(dueDate)) return { ok: false, message: "Captura una fecha de vencimiento válida." }

  const { supabase } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { error } = await supabase.rpc("regularize_enrollment_financial_start", {
    p_enrollment_id: input.enrollmentId,
    p_economic_start_on: input.economicStartOn,
    p_initial_period_amount: amount,
    p_initial_period_due_date: dueDate,
    p_reason: input.reason.trim(),
  })

  if (error) return { ok: false, message: mapFinancialStartRegularizationError(error.message) }
  revalidatePath("/admin/matricula")
  revalidatePath(`/admin/alumnos/${input.studentId}`)
  revalidatePath(`/admin/alumnos/${input.studentId}/cuenta`)
  return { ok: true }
}

function mapFinancialStartRegularizationError(message: string | undefined) {
  const technical = message?.toLowerCase() ?? ""
  if (technical.includes("applied payment") || technical.includes("applied credit") || technical.includes("credit applied")) {
    return "No se puede regularizar el inicio porque hay pagos o saldos a favor aplicados. Corrige primero su aplicación."
  }
  if (technical.includes("below already applied amount") || technical.includes("less than applied")) {
    return "El importe inicial no puede ser menor a los fondos ya aplicados."
  }
  if (technical.includes("must belong") || technical.includes("outside enrollment cycle") || technical.includes("enrollment cycle")) {
    return "La fecha de inicio económico debe estar dentro del ciclo escolar."
  }
  if (technical.includes("active enrollment")) return "Solo se puede regularizar una matrícula activa."
  if (process.env.NODE_ENV !== "production" && message) return `No pudimos regularizar el inicio financiero. Detalle: ${message}`
  return "No pudimos regularizar el inicio financiero. Revisa los datos e inténtalo de nuevo."
}

function validateMutationInput(effectiveOn: string, reason: string, action: "plan" | "group" | "classification" | "grade" | "dates") {
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
    if (!input.enrollmentFeeAmount?.trim() || !Number.isFinite(amount) || amount <= 0) {
      return "El importe de inscripción proporcional debe ser mayor que cero."
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
