import type { SupabaseClient } from "@supabase/supabase-js"

export type TuitionDiscountCategory = {
  id: string
  cycleId: string
  name: string
  discountType: "PERCENTAGE" | "FIXED_AMOUNT"
  isActive: boolean
  versionStatus: "CURRENT" | "SCHEDULED" | null
  currentVersion: {
    value: number
    validFrom: string
    validUntil: string | null
  } | null
  versions: Array<{
    value: number
    validFrom: string
    validUntil: string | null
  }>
}

type RecordValue = Record<string, unknown>

function records(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === "object")
    : []
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

export async function getTuitionDiscountCategories(
  supabase: SupabaseClient,
  cycleId: string
): Promise<{ data: TuitionDiscountCategory[]; error: boolean }> {
  const { data, error } = await supabase
    .from("tuition_discount_categories")
    .select("id, cycle_id, name, discount_type, is_active, tuition_discount_category_versions(value, valid_from, valid_until)")
    .eq("cycle_id", cycleId)
    .order("name")

  if (error) return { data: [], error: true }

  const today = dateInput(new Date())

  return {
    data: (data ?? []).flatMap((row) => {
      const category = row as unknown as RecordValue
      const discountType = text(category.discount_type)
      if (discountType !== "PERCENTAGE" && discountType !== "FIXED_AMOUNT") return []

      const rawVersions = records(category.tuition_discount_category_versions)
      const currentVersion = rawVersions
        .filter((version) => {
          const validFrom = text(version.valid_from)
          const validUntil = typeof version.valid_until === "string" ? version.valid_until : null
          return validFrom <= today && (!validUntil || validUntil >= today)
        })
        .sort((left, right) => text(right.valid_from).localeCompare(text(left.valid_from)))[0]
      const scheduledVersion = rawVersions
        .filter((version) => text(version.valid_from) > today)
        .sort((left, right) => text(left.valid_from).localeCompare(text(right.valid_from)))[0]
      const displayVersion = currentVersion ?? scheduledVersion
      const versions = versionsForCategory(rawVersions)

      return [{
        id: text(category.id),
        cycleId: text(category.cycle_id),
        name: text(category.name),
        discountType,
        isActive: category.is_active === true,
        versionStatus: currentVersion ? "CURRENT" : displayVersion ? "SCHEDULED" : null,
        currentVersion: displayVersion
          ? {
            value: Number(displayVersion.value),
            validFrom: text(displayVersion.valid_from),
            validUntil:
              typeof displayVersion.valid_until === "string"
                ? displayVersion.valid_until
                : null,
          }
          : null,
        versions,
      }]
    }),
    error: false,
  }
}

function versionsForCategory(versions: RecordValue[]) {
  return versions.flatMap((version) => {
    const value = Number(version.value)
    const validFrom = text(version.valid_from)
    if (!Number.isFinite(value) || !validFrom) return []

    return [{
      value,
      validFrom,
      validUntil: typeof version.valid_until === "string" ? version.valid_until : null,
    }]
  })
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}
