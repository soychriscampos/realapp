import type { SupabaseClient } from "@supabase/supabase-js"

export type PaymentMethodOption = {
  id: string
  code: string
  name: string
  classification: string
  requiresDescription: boolean
}

export type PaymentReceiverOption = {
  id: string
  fullName: string
}

export type PaymentFormContext = {
  methods: PaymentMethodOption[]
  receivers: PaymentReceiverOption[]
  currentReceiverId: string | null
}

type PaymentMethodRow = {
  id: unknown
  code: unknown
  name: unknown
  classification: unknown
  requires_description: unknown
}

type StaffRow = {
  id: unknown
  full_name: unknown
  profile_id: unknown
}

export async function getPaymentFormContext(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: PaymentFormContext | null; error: boolean }> {
  const [methodsResult, staffResult] = await Promise.all([
    supabase
      .from("payment_methods")
      .select("id, code, name, classification, requires_description")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("staff")
      .select("id, full_name, profile_id")
      .eq("status", "ACTIVE")
      .order("full_name"),
  ])

  if (methodsResult.error || staffResult.error) {
    return { data: null, error: true }
  }

  const methods = (methodsResult.data as PaymentMethodRow[] | null) ?? []
  const staff = (staffResult.data as StaffRow[] | null) ?? []
  const currentStaff = staff.find((row) => text(row.profile_id) === userId)

  return {
    data: {
      methods: methods.map((row) => ({
        id: text(row.id),
        code: text(row.code),
        name: text(row.name),
        classification: text(row.classification),
        requiresDescription: row.requires_description === true,
      })),
      receivers: staff.map((row) => ({
        id: text(row.id),
        fullName: text(row.full_name),
      })),
      currentReceiverId: currentStaff ? text(currentStaff.id) : null,
    },
    error: false,
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}
