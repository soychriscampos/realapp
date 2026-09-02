import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const token = url.searchParams.get("token")
  if (!code || !token || !/^[0-9a-f]{64}$/i.test(token)) return NextResponse.redirect(new URL("/login?error=invalid", request.url))
  const supabase = await createClient(); const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return NextResponse.redirect(new URL("/login?error=invalid", request.url))
  const { error } = await supabase.rpc("complete_family_onboarding", { p_token_hash: createHash("sha256").update(token).digest("hex") })
  return NextResponse.redirect(new URL(error ? "/login?error=onboarding" : "/tutor", request.url))
}
