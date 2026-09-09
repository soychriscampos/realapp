import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getHomeRoute } from "@/lib/auth/home-route"
import { resolvePendingOnboarding } from "@/lib/auth/onboarding"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const token = url.searchParams.get("token")
  const supabase = await createClient()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) return NextResponse.redirect(new URL("/login?error=invalid", request.url))
  }

  if (token && /^[0-9a-f]{64}$/i.test(token)) {
    const { error } = await supabase.rpc("complete_family_onboarding", {
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    })
    if (error) return NextResponse.redirect(new URL("/login?error=onboarding", request.url))
  } else {
    try {
      await resolvePendingOnboarding(supabase)
    } catch {
      return NextResponse.redirect(new URL("/login?error=onboarding", request.url))
    }
  }

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  const homeRoute = typeof userId === 'string' ? await getHomeRoute(supabase, userId) : null
  return NextResponse.redirect(new URL(homeRoute ?? "/login?error=unauthorized", request.url))
}
