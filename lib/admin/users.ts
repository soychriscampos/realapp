import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminUserStatus =
  | 'INVITATION_PENDING'
  | 'WAITING_CONFIRMATION'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_REVOKED'
  | 'ACCESS_ACTIVE'
  | 'ACCESS_INACTIVE'

export type AdminUser = {
  id: string
  staffId: string
  name: string
  email: string | null
  role: 'MASTER' | 'ADMINISTRATIVO'
  status: AdminUserStatus
  invitationId: string | null
  expiresAt: string | null
}

export async function getAdminUsers(supabase: SupabaseClient): Promise<AdminUser[]> {
  const [{ data: staff, error: staffError }, { data: invitations, error: invitationError }, { data: roles, error: rolesError }, { data: profiles, error: profilesError }, { data: userRoles, error: userRolesError }] = await Promise.all([
    supabase.from('staff').select('id,full_name,status,profile_id').order('full_name'),
    supabase.from('staff_invitations').select('id,staff_id,email,initial_role_id,status,expires_at,created_at').order('created_at', { ascending: false }),
    supabase.from('roles').select('id,code').in('code', ['MASTER', 'ADMINISTRATIVO']),
    supabase.from('profiles').select('id,is_active'),
    supabase.from('user_roles').select('user_id,role_id,valid_from,valid_until').order('valid_from', { ascending: false }),
  ])

  const error = staffError ?? invitationError ?? rolesError ?? profilesError ?? userRolesError
  if (error) throw new Error(`No se pudieron cargar los usuarios administrativos: ${error.message}`)

  const roleById = new Map((roles ?? []).map((role) => [role.id, role.code as AdminUser['role']]))
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.is_active]))
  const roleByUser = new Map<string, AdminUser['role']>()
  const now = new Date()
  for (const userRole of userRoles ?? []) {
    const role = roleById.get(userRole.role_id)
    const validFrom = new Date(userRole.valid_from)
    const validUntil = userRole.valid_until ? new Date(userRole.valid_until) : null
    if (role && validFrom <= now && (!validUntil || validUntil > now) && !roleByUser.has(userRole.user_id)) roleByUser.set(userRole.user_id, role)
  }
  const invitationByStaff = new Map<string, NonNullable<typeof invitations>[number]>()
  for (const invitation of invitations ?? []) {
    if (!invitationByStaff.has(invitation.staff_id)) invitationByStaff.set(invitation.staff_id, invitation)
  }

  return (staff ?? []).map((person) => {
    const invitation = invitationByStaff.get(person.id)
    const role = person.profile_id ? roleByUser.get(person.profile_id) : undefined
    const isExpired = invitation?.status === 'PENDING' && new Date(invitation.expires_at) <= new Date()
    const status: AdminUserStatus = person.profile_id
      ? profileById.get(person.profile_id) === false ? 'ACCESS_INACTIVE' : 'ACCESS_ACTIVE'
      : invitation?.status === 'REVOKED' ? 'INVITATION_REVOKED'
        : isExpired ? 'INVITATION_EXPIRED'
          : invitation?.email ? 'WAITING_CONFIRMATION' : 'INVITATION_PENDING'

    return {
      id: person.profile_id ?? person.id,
      staffId: person.id,
      name: person.full_name,
      email: invitation?.email ?? null,
      role: role ?? (invitation ? roleById.get(invitation.initial_role_id) : undefined) ?? 'ADMINISTRATIVO',
      status,
      invitationId: invitation?.id ?? null,
      expiresAt: invitation?.expires_at ?? null,
    }
  })
}

export async function getStaffInvitation(supabase: SupabaseClient, tokenHash: string) {
  const { data, error } = await supabase.rpc('get_staff_invitation_by_token', { p_token_hash: tokenHash })
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}
