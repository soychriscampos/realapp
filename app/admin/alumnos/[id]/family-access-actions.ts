'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require-role'
import { getSiteUrl } from '@/lib/site/url'

type Result = { ok: true; link?: string } | { ok: false; message: string }
const token = () => { const raw = randomBytes(32).toString('hex'); return { raw, hash: createHash('sha256').update(raw).digest('hex') } }
const expires = () => new Date(Date.now() + 7 * 86400000).toISOString()
const errorMessage = (error?: { message?: string } | null) => error?.message?.replace(/^.*?ERROR:\s*/i, '').trim() || 'No se pudo completar la operación.'

export async function getFamilyGuardianContext(guardianId: string) {
  const { supabase } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const [{ data, error }, { data: guardian, error: guardianError }] = await Promise.all([
    supabase.rpc('get_family_guardian_context', { p_guardian_id: guardianId }),
    supabase.from('guardians').select('auth_user_id').eq('id', guardianId).maybeSingle(),
  ])
  if (error || guardianError) return { ok: false as const, message: errorMessage(error ?? guardianError) }
  const contextRows = (data ?? []) as Array<Record<string, unknown>>
  return { ok: true as const, rows: contextRows.map((row) => ({ ...row, guardian_has_auth: Boolean(guardian?.auth_user_id) })) }
}

export async function createFamilyInvitation(input: { guardianId: string; studentIds: string[] }): Promise<Result> {
  const { supabase } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const invite = token()
  const { data, error } = await supabase.rpc('create_family_invitation', { p_guardian_id: input.guardianId, p_student_ids: input.studentIds, p_token_hash: invite.hash, p_expires_at: expires() })
  if (error || !data) return { ok: false, message: errorMessage(error) }
  revalidatePath('/admin/alumnos')
  return { ok: true, link: `${getSiteUrl()}/onboarding/familia?token=${invite.raw}` }
}

export async function grantFamilyAccessToExistingGuardian(input: { guardianId: string; studentId: string }): Promise<Result> {
  const { supabase } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const { data, error } = await supabase.rpc('grant_family_access_to_existing_guardian', { p_guardian_id: input.guardianId, p_student_id: input.studentId })
  return error || !data ? { ok: false, message: errorMessage(error) } : { ok: true }
}

export async function regenerateFamilyInvitation(invitationId: string): Promise<Result> {
  const { supabase } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const invite = token()
  const { data, error } = await supabase.rpc('regenerate_family_invitation', { p_invitation_id: invitationId, p_token_hash: invite.hash, p_expires_at: expires() })
  if (error || !data) return { ok: false, message: errorMessage(error) }
  return { ok: true, link: `${getSiteUrl()}/onboarding/familia?token=${invite.raw}` }
}

export async function revokeFamilyInvitation(invitationId: string): Promise<Result> {
  const { supabase } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const { data, error } = await supabase.rpc('revoke_family_invitation', { p_invitation_id: invitationId })
  return error || !data ? { ok: false, message: errorMessage(error) } : { ok: true }
}

export async function revokeFamilyAccess(input: { familyAccessId: string; reason: string }): Promise<Result> {
  const { supabase } = await requireRole(['MASTER', 'ADMINISTRATIVO'])
  const { data, error } = await supabase.rpc('revoke_family_access', { p_family_access_id: input.familyAccessId, p_reason: input.reason.trim() })
  return error || !data ? { ok: false, message: errorMessage(error) } : { ok: true }
}
