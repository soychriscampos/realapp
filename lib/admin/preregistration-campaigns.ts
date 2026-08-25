import type { SupabaseClient } from "@supabase/supabase-js"

export type PreregistrationCampaign = {
  id: string
  name: string
  targetCycleId: string
  educationLevelId: string | null
  targetCycleName: string
  educationLevelName: string | null
  startsOn: string
  endsOn: string
  price: number
  coveredConceptName: string | null
  allowsPartialPayments: boolean
  nonContinuationPolicy: string
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED"
}

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export async function getPreregistrationCampaigns(
  supabase: SupabaseClient
): Promise<{ data: PreregistrationCampaign[]; error: boolean }> {
  const { data, error } = await supabase
    .from("preregistration_campaigns")
    .select("id, name, target_cycle_id, education_level_id, starts_on, ends_on, price, allows_partial_payments, non_continuation_policy, status, school_cycles!inner(name), education_levels(name), financial_concepts(name)")
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: true }

  return {
    data: ((data ?? []) as unknown as RecordValue[]).flatMap((campaign) => {
      const cycle = record(campaign.school_cycles)
      const level = record(campaign.education_levels)
      const concept = record(campaign.financial_concepts)
      const status = text(campaign.status)
      if (!cycle || !text(campaign.id) || !text(campaign.name) || !text(campaign.target_cycle_id) || !text(campaign.starts_on) || !text(campaign.ends_on) || !Number.isFinite(Number(campaign.price)) || !["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"].includes(status)) return []

      return [{
        id: text(campaign.id),
        name: text(campaign.name),
        targetCycleId: text(campaign.target_cycle_id),
        educationLevelId: text(campaign.education_level_id) || null,
        targetCycleName: text(cycle.name),
        educationLevelName: level ? text(level.name) || null : null,
        startsOn: text(campaign.starts_on),
        endsOn: text(campaign.ends_on),
        price: Number(campaign.price),
        coveredConceptName: concept ? text(concept.name) || null : null,
        allowsPartialPayments: campaign.allows_partial_payments === true,
        nonContinuationPolicy: text(campaign.non_continuation_policy),
        status: status as PreregistrationCampaign["status"],
      }]
    }),
    error: false,
  }
}
