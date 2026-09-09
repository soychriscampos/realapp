import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type PendingOnboardingResult =
  | 'NONE'
  | 'FAMILY_COMPLETED'
  | 'STAFF_COMPLETED'

type OnboardingRpcResult = {
  status?: string
}

export async function resolvePendingOnboarding(
  supabase?: SupabaseClient,
): Promise<PendingOnboardingResult> {
  const client = supabase ?? (await createClient())
  const { data: familyResult, error: familyError } = await client.rpc(
    'complete_pending_family_onboarding',
  )

  if (familyError) throw familyError

  if ((familyResult as OnboardingRpcResult | null)?.status === 'COMPLETED') {
    return 'FAMILY_COMPLETED'
  }

  const { data: staffResult, error: staffError } = await client.rpc(
    'complete_pending_staff_onboarding',
  )

  if (staffError) throw staffError

  if ((staffResult as OnboardingRpcResult | null)?.status === 'COMPLETED') {
    return 'STAFF_COMPLETED'
  }

  return 'NONE'
}
