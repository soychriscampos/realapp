'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth/require-role'
import { getSiteUrl } from '@/lib/site/url'

export type UserMutationResult = { ok: true; link?: string } | { ok: false; message: string }

function token() {
  const raw = randomBytes(32).toString('hex')
  return { raw, hash: createHash('sha256').update(raw).digest('hex') }
}

function expiresAt() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
}

function rpcMessage(message: string) {
  if (/permission|not authorized|insufficient/i.test(message)) return 'No tienes permisos para administrar usuarios.'
  if (/duplicate|unique|correo/i.test(message)) return 'Ya existe una invitación pendiente para ese correo.'
  return message.replace(/^.*?ERROR:\s*/i, '').trim() || 'No se pudo completar la operación.'
}

export async function createStaffInvitation(input: { name: string; role: 'MASTER' | 'ADMINISTRATIVO' }): Promise<UserMutationResult> {
  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Indica el nombre de la persona.' }
  const { supabase } = await requireRole(['MASTER'])
  const inviteToken = token()
  const { data, error } = await supabase.rpc('create_staff_invitation', {
    p_full_name: name,
    p_role_code: input.role,
    p_token_hash: inviteToken.hash,
    p_expires_at: expiresAt(),
  })
  if (error || !data) return { ok: false, message: rpcMessage(error?.message ?? 'No se pudo crear la invitación.') }
  revalidatePath('/admin/usuarios')
  return { ok: true, link: `${getSiteUrl()}/onboarding/staff?token=${inviteToken.raw}` }
}

export async function regenerateStaffInvitation(input: { invitationId: string }): Promise<UserMutationResult> {
  if (!input.invitationId) return { ok: false, message: 'No encontramos la invitación.' }
  const { supabase } = await requireRole(['MASTER'])
  const inviteToken = token()
  const { data, error } = await supabase.rpc('regenerate_staff_invitation', { p_invitation_id: input.invitationId, p_token_hash: inviteToken.hash, p_expires_at: expiresAt() })
  if (error || !data) return { ok: false, message: rpcMessage(error?.message ?? 'La invitación ya no está disponible.') }
  revalidatePath('/admin/usuarios')
  return { ok: true, link: `${getSiteUrl()}/onboarding/staff?token=${inviteToken.raw}` }
}

export async function revokeStaffInvitation(input: { invitationId: string; reason?: string }): Promise<UserMutationResult> {
  const { supabase } = await requireRole(['MASTER'])
  const { data, error } = await supabase.rpc('revoke_staff_invitation', { p_invitation_id: input.invitationId, p_reason: input.reason?.trim() || 'Revocada por un administrador.' })
  if (error || !data) return { ok: false, message: rpcMessage(error?.message ?? 'La invitación ya no está disponible.') }
  revalidatePath('/admin/usuarios')
  return { ok: true }
}

export async function setStaffAccess(input: { userId: string; active: boolean }): Promise<UserMutationResult> {
  if (!input.userId) return { ok: false, message: 'No encontramos el usuario.' }
  const { supabase } = await requireRole(['MASTER'])
  const { data, error } = await supabase.rpc('set_staff_access_active', { p_user_id: input.userId, p_is_active: input.active })
  if (error || !data) return { ok: false, message: rpcMessage(error?.message ?? 'No se pudo cambiar el acceso.') }
  revalidatePath('/admin/usuarios')
  return { ok: true }
}

export async function claimStaffInvitationEmail(tokenHash: string, email: string) {
  const supabase = (await import('@/lib/supabase/server')).createPublicClient
  const client = await supabase()
  console.info('[staff onboarding] claim:server:start', { hasTokenHash: Boolean(tokenHash), hasEmail: Boolean(email.trim()) })
  try {
    const { error } = await client.rpc('claim_staff_invitation_email', { p_token_hash: tokenHash, p_email: email.trim() })
    console.info('[staff onboarding] claim:server:result', { ok: !error, error: error?.name ?? null })
    return error ? { ok: false as const, message: 'La invitación no es válida o el correo ya fue asociado.' } : { ok: true as const }
  } catch (caughtError) {
    console.error('[staff onboarding] claim:server:error', caughtError instanceof Error ? { name: caughtError.name, message: caughtError.message } : { valueType: typeof caughtError })
    return { ok: false as const, message: 'No pudimos validar la invitación. Intenta de nuevo.' }
  }
}
