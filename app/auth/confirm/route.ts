import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  if (!tokenHash || type !== 'signup') {
    console.error('[Auth confirm] invalid confirmation parameters', {
      hasTokenHash: Boolean(tokenHash),
      type,
    })
    return NextResponse.redirect(new URL('/login?error=invalid', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'signup',
  })

  if (error) {
    const errorWithDetails = error as typeof error & {
      details?: string
      hint?: string
    }
    console.error('[Auth confirm] verifyOtp failed', {
      name: error.name,
      code: error.code ?? null,
      message: error.message,
      details: errorWithDetails.details ?? null,
      hint: errorWithDetails.hint ?? null,
      status: error.status ?? null,
    })
    return NextResponse.redirect(new URL('/login?error=invalid', request.url))
  }

  return NextResponse.redirect(new URL('/login?confirmed=1', request.url))
}
