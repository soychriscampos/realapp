import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const token = url.searchParams.get('token')
  if (!code || !token || !/^[0-9a-f]{64}$/i.test(token)) {
    console.warn('[staff onboarding callback] invalid parameters', { hasCode: Boolean(code), hasToken: Boolean(token) })
    return NextResponse.redirect(new URL('/login?error=invalid', request.url))
  }
  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    console.error('[staff onboarding callback] exchange error', { name: exchangeError.name, message: exchangeError.message, code: exchangeError.code ?? null })
    return NextResponse.redirect(new URL('/login?error=invalid', request.url))
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  console.info('[staff onboarding callback] session result', { hasUser: Boolean(userData.user), hasEmail: Boolean(userData.user?.email), confirmed: Boolean(userData.user?.email_confirmed_at), error: userError?.name ?? null })
  if (userError || !userData.user) {
    console.error('[staff onboarding callback] user unavailable', { name: userError?.name ?? null, message: userError?.message ?? null })
    return NextResponse.redirect(new URL('/login?error=onboarding', request.url))
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { error: completionError } = await supabase.rpc('complete_staff_onboarding', { p_token_hash: tokenHash })
  if (completionError) {
    console.error('[staff onboarding callback] completion error', { name: completionError.name, message: completionError.message, code: completionError.code ?? null, details: completionError.details ?? null, hint: completionError.hint ?? null })
    // Conserva la sesión para que el usuario pueda ver el error y reintentar
    // cuando el problema transitorio haya sido corregido.
    return NextResponse.redirect(new URL('/login?error=onboarding', request.url))
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?confirmed=1', request.url))
}
