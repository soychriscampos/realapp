import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RECOVERY_COOKIE = 'real-password-recovery'
const RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')

  if (!tokenHash) {
    return NextResponse.redirect(
      new URL('/recuperar-contrasena?error=invalid-link', request.url)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  })

  if (error) {
    return NextResponse.redirect(
      new URL('/recuperar-contrasena?error=invalid-link', request.url)
    )
  }

  const response = NextResponse.redirect(new URL('/nueva-contrasena', request.url))
  response.cookies.set(RECOVERY_COOKIE, '1', {
    httpOnly: true,
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
