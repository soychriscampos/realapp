import type { SupabaseClient } from "@supabase/supabase-js"

export type StudentFilters = {
  globalSearch?: boolean
  contextCycleId?: string
  cycleId?: string
  educationLevelId?: string
  gradeLevelId?: string
  groupId?: string
  status?: string
  classificationId?: string
  query?: string
}

export type StudentListItem = {
  id: string
  fullName: string
  studentCode: string | null
  enrollment: {
    id: string
    status: string
    enrolledOn: string
    classesStartOn: string | null
    cycle: { id: string; name: string; code: string; status: string }
    educationLevel: { id: string; name: string }
    gradeLevel: { id: string; name: string }
    group: { id: string; name: string; code: string } | null
    classification: { id: string; name: string; code: string }
  } | null
}

export type StudentDetail = {
  id: string
  fullName: string
  studentCode: string | null
  birthDate: string | null
  sex: string | null
  enrollment: StudentListItem["enrollment"] | null
  guardians: Array<{
    guardianId: string
    fullName: string
    relationship: string
    phone: string | null
    email: string | null
    viaEmail: boolean
    viaWhatsapp: boolean
  }>
  familyAccess: Array<{
    guardianName: string
    status: "ACTIVE" | "REVOKED"
  }>
}

export type StudentSearchResult = {
  id: string
  fullName: string
  gradeName: string | null
  groupName: string | null
  status: string
}

type RelatedRecord = Record<string, unknown> | null

function asRecord(value: unknown): RelatedRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export async function getStudentCatalogs(supabase: SupabaseClient) {
  const { data: cycles, error: cyclesError } = await supabase
    .from("school_cycles")
    .select("id, code, name, starts_on, ends_on, status")
    .order("starts_on", { ascending: false })

  if (cyclesError) {
    return { error: true as const, catalogs: null }
  }

  const operationalCycle =
    cycles?.find((cycle) => cycle.status === "ACTIVE") ??
    cycles?.find((cycle) => cycle.status === "PREPARATION") ??
    cycles?.[0] ??
    null

  const [levelsResult, gradesResult, classificationsResult] = await Promise.all([
    supabase
      .from("education_levels")
      .select("id, name, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("grade_levels")
      .select("id, name, education_level_id, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("enrollment_classifications")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name"),
  ])

  if (levelsResult.error || gradesResult.error || classificationsResult.error) {
    return { error: true as const, catalogs: null }
  }

  return {
    error: false as const,
    catalogs: {
      cycles: cycles ?? [],
      operationalCycle,
      levels: levelsResult.data ?? [],
      grades: gradesResult.data ?? [],
      classifications: classificationsResult.data ?? [],
    },
  }
}

export async function getGroupsForCycle(
  supabase: SupabaseClient,
  cycleId: string | undefined
) {
  if (!cycleId) return []

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, code, grade_level_id")
    .eq("cycle_id", cycleId)
    .eq("is_active", true)
    .order("name")

  return error ? null : data ?? []
}

export async function getStudents(
  supabase: SupabaseClient,
  filters: StudentFilters
): Promise<{ data: StudentListItem[]; error: boolean }> {
  const contextCycleId = filters.globalSearch ? undefined : filters.cycleId ?? filters.contextCycleId
  const hasEnrollmentFilters = Boolean(
    filters.cycleId ||
      filters.educationLevelId ||
      filters.gradeLevelId ||
      filters.groupId ||
      filters.status ||
      filters.classificationId
  )
  const enrollmentRelation = hasEnrollmentFilters
    ? "enrollments!inner"
    : "enrollments"
  const enrollmentSelection = filters.globalSearch
    ? `, enrollments(id, status, enrolled_on, classes_start_on, school_cycles!inner(id, code, name, status), grade_levels!inner(id, name, education_level_id, education_levels!inner(id, name)), groups(id, name, code), enrollment_classifications!inner(id, name, code))`
    : contextCycleId
    ? `, ${enrollmentRelation}(id, status, enrolled_on, classes_start_on, school_cycles!inner(id, code, name, status), grade_levels!inner(id, name, education_level_id, education_levels!inner(id, name)), groups(id, name, code), enrollment_classifications!inner(id, name, code))`
    : ""
  const studentSelection: string = `id, full_name, student_code${enrollmentSelection}`

  let query = supabase
    .from("students")
    .select(studentSelection)
    .order("full_name", { ascending: true })
    .limit(50)

  if (filters.query) {
    const namePattern = buildStudentNameSearchPattern(filters.query)
    const codeTerm = filters.query.trim().replace(/[(),]/g, " ")
    query = query.or(`full_name.imatch.${namePattern},student_code.ilike.%${codeTerm}%`)
  }

  if (contextCycleId) query = query.eq("enrollments.cycle_id", contextCycleId)
  if (filters.gradeLevelId) query = query.eq("enrollments.grade_level_id", filters.gradeLevelId)
  if (filters.groupId) query = query.eq("enrollments.group_id", filters.groupId)
  if (filters.status) query = query.eq("enrollments.status", filters.status)
  if (filters.classificationId) {
    query = query.eq("enrollments.classification_id", filters.classificationId)
  }

  if (filters.educationLevelId) {
    const { data: gradeLevels, error } = await supabase
      .from("grade_levels")
      .select("id")
      .eq("education_level_id", filters.educationLevelId)

    if (error) return { data: [], error: true }

    query = query.in(
      "enrollments.grade_level_id",
      (gradeLevels ?? []).map((grade) => grade.id)
    )
  }

  const { data, error } = await query

  if (error) return { data: [], error: true }

  const rows = data as unknown as Array<Record<string, unknown>> | null

  return {
    data: (rows ?? []).map((row) => ({
      id: asText(row.id),
      fullName: asText(row.full_name),
      studentCode: typeof row.student_code === "string" ? row.student_code : null,
      enrollment: mapEnrollment(asRecords(row.enrollments)[0]),
    })),
    error: false,
  }
}

export async function searchStudents(
  supabase: SupabaseClient,
  term: string,
  cycleId?: string
): Promise<{ data: StudentSearchResult[]; error: boolean }> {
  const enrollmentSelection = cycleId
    ? ", enrollments(id, status, cycle_id, enrolled_on, grade_levels(name), groups(name))"
    : ""
  const selection: string = `id, full_name${enrollmentSelection}`

  let query = supabase
    .from("students")
    .select(selection)
    .filter("full_name", "imatch", buildStudentNameSearchPattern(term))
    .order("full_name", { ascending: true })
    .limit(8)

  if (cycleId) query = query.eq("enrollments.cycle_id", cycleId)

  const { data, error } = await query

  if (error) return { data: [], error: true }

  const rows = data as unknown as Array<Record<string, unknown>> | null

  return {
    data: (rows ?? []).map((row) => {
      const enrollment = asRecords(row.enrollments)[0]
      const grade = asRecord(enrollment?.grade_levels)
      const group = asRecord(enrollment?.groups)

      return {
        id: asText(row.id),
        fullName: asText(row.full_name),
        gradeName: grade ? asText(grade.name) : null,
        groupName: group ? asText(group.name) : null,
        status: enrollment ? asText(enrollment.status) : "",
      }
    }),
    error: false,
  }
}

export async function getStudentDetail(
  supabase: SupabaseClient,
  studentId: string,
  cycleId: string | undefined
): Promise<{ data: StudentDetail | null; error: boolean }> {
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, student_code, birth_date, sex")
    .eq("id", studentId)
    .maybeSingle()

  if (studentError) return { data: null, error: true }
  if (!student) return { data: null, error: false }

  const [enrollmentResult, guardiansResult, familyAccessResult] = await Promise.all([
    cycleId
      ? supabase
          .from("enrollments")
          .select(
            "id, student_id, status, enrolled_on, classes_start_on, students!inner(id, full_name, student_code), school_cycles!inner(id, code, name, status), grade_levels!inner(id, name, education_level_id, education_levels!inner(id, name)), groups(id, name, code), enrollment_classifications!inner(id, name, code)"
          )
          .eq("student_id", studentId)
          .eq("cycle_id", cycleId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("student_guardians")
      .select("guardian_id, relationship, priority, via_email, via_whatsapp, guardians!inner(full_name, phone, email)")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .order("priority"),
    supabase
      .from("family_access")
      .select("status, guardians!inner(full_name)")
      .eq("student_id", studentId)
      .order("granted_at", { ascending: false }),
  ])

  if (enrollmentResult.error || guardiansResult.error || familyAccessResult.error) {
    return { data: null, error: true }
  }

  const enrollment = enrollmentResult.data
    ? mapEnrollment(enrollmentResult.data)
    : null

  return {
    data: {
      id: asText(student.id),
      fullName: asText(student.full_name),
      studentCode: typeof student.student_code === "string" ? student.student_code : null,
      birthDate: typeof student.birth_date === "string" ? student.birth_date : null,
      sex: typeof student.sex === "string" ? student.sex : null,
      enrollment,
      guardians: (guardiansResult.data ?? []).flatMap((row) => {
        const guardian = asRecord(row.guardians)
        if (!guardian) return []

        return [{
          guardianId: asText(row.guardian_id),
          fullName: asText(guardian.full_name),
          relationship: asText(row.relationship),
          phone: typeof guardian.phone === "string" && guardian.phone.trim() ? guardian.phone : null,
          email: typeof guardian.email === "string" && guardian.email.trim() ? guardian.email : null,
          viaEmail: row.via_email === true,
          viaWhatsapp: row.via_whatsapp === true,
        }]
      }),
      familyAccess: (familyAccessResult.data ?? []).flatMap((row) => {
        const guardian = asRecord(row.guardians)
        const status = row.status === "ACTIVE" || row.status === "REVOKED" ? row.status : null
        if (!guardian || !status) return []

        return [{ guardianName: asText(guardian.full_name), status }]
      }),
    },
    error: false,
  }
}

function mapEnrollment(
  row: Record<string, unknown> | undefined
): StudentListItem["enrollment"] {
  if (!row) return null
  const cycle = asRecord(row.school_cycles)
  const gradeLevel = asRecord(row.grade_levels)
  const educationLevel = asRecord(gradeLevel?.education_levels)
  const classification = asRecord(row.enrollment_classifications)

  if (!cycle || !gradeLevel || !educationLevel || !classification) return null

  const group = asRecord(row.groups)

  return {
    id: asText(row.id),
    status: asText(row.status),
    enrolledOn: asText(row.enrolled_on),
    classesStartOn:
      typeof row.classes_start_on === "string" ? row.classes_start_on : null,
    cycle: {
      id: asText(cycle.id),
      name: asText(cycle.name),
      code: asText(cycle.code),
      status: asText(cycle.status),
    },
    educationLevel: { id: asText(educationLevel.id), name: asText(educationLevel.name) },
    gradeLevel: { id: asText(gradeLevel.id), name: asText(gradeLevel.name) },
    group: group
      ? { id: asText(group.id), name: asText(group.name), code: asText(group.code) }
      : null,
    classification: {
      id: asText(classification.id),
      name: asText(classification.name),
      code: asText(classification.code),
    },
  }
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      )
    : []
}

export function buildStudentNameSearchPattern(value: string) {
  const sanitized = value
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX")

  const pattern = [...sanitized]
    .map((character) => {
      const escaped = escapeRegexCharacter(character)

      return {
        a: "[aáàäâ]",
        e: "[eéèëê]",
        i: "[iíìïî]",
        o: "[oóòöô]",
        u: "[uúùüû]",
        n: "[nñ]",
      }[character] ?? escaped
    })
    .join("")

  return `.*${pattern}.*`
}

function escapeRegexCharacter(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
}
