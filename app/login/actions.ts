'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHomeRoute } from '@/lib/auth/home-route'
import { resolvePendingOnboarding } from '@/lib/auth/onboarding'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=missing')
  }

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !user) {
    redirect('/login?error=invalid')
  }

  try {
    await resolvePendingOnboarding(supabase)
  } catch {
    redirect('/login?error=onboarding')
  }

  const homeRoute = await getHomeRoute(supabase, user.id)

  if (!homeRoute) {
    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  redirect(homeRoute)
}
