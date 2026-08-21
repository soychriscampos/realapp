import type { SupabaseClient } from '@supabase/supabase-js'

export async function getHomeRoute(
  supabase: SupabaseClient,
  userId: string
) {
  const now = new Date().toISOString()

  const { data: userRole, error: userRoleError } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (userRoleError || !userRole) {
    return null
  }

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('code')
    .eq('id', userRole.role_id)
    .eq('is_active', true)
    .maybeSingle()

  if (roleError || !role) {
    return null
  }

  switch (role.code) {
    case 'MASTER':
    case 'ADMINISTRATIVO':
      return '/admin'

    case 'PROFESOR':
      return '/profesor'

    case 'TUTOR':
      return '/tutor'

    default:
      return null
  }
}
