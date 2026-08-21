import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHomeRoute } from '@/lib/auth/home-route'

type AppRole = 'MASTER' | 'ADMINISTRATIVO' | 'PROFESOR' | 'TUTOR'

export async function requireRole(allowedRoles: AppRole[]) {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) {
    redirect('/login')
  }

  const now = new Date().toISOString()

  const { data: userRoles, error: userRolesError } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)

  if (userRolesError || !userRoles?.length) {
    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  const roleIds = userRoles.map((row) => row.role_id)

  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('code')
    .in('id', roleIds)
    .eq('is_active', true)

  if (rolesError || !roles?.length) {
    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  const currentRoles = roles.map((role) => role.code as AppRole)

  const isAllowed = currentRoles.some((role) =>
    allowedRoles.includes(role)
  )

  if (!isAllowed) {
    const homeRoute = await getHomeRoute(supabase, userId)

    if (homeRoute) {
      redirect(homeRoute)
    }

    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  return {
    userId,
    roles: currentRoles,
    supabase,
  }
}