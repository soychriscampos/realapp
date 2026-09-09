import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getHomeRoute } from "@/lib/auth/home-route"
import { resolvePendingOnboarding } from "@/lib/auth/onboarding"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const token = url.searchParams.get("token")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  const next = url.searchParams.get("next")
  const queryError = url.searchParams.get("error")
  const queryErrorCode = url.searchParams.get("error_code")
  const queryErrorDescription = url.searchParams.get("error_description")

  console.info("[Family onboarding callback] entered", {
    pathname: url.pathname,
    hasCode: Boolean(code),
    hasInvitationToken: Boolean(token),
    hasTokenHash: Boolean(tokenHash),
    type,
    next,
    queryError,
    queryErrorCode,
    queryErrorDescription,
  })

  const supabase = await createClient()

  if (code) {
    console.info("[Family onboarding callback] exchangeCodeForSession attempting", {
      hasCode: true,
      pathname: url.pathname,
      hasInvitationToken: Boolean(token),
    })
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    console.info("[Family onboarding callback] exchangeCodeForSession result", {
      success: !exchangeError,
      error: errorDetails(exchangeError),
    })
    if (exchangeError) {
      console.error("[Family onboarding callback] redirecting error", {
        branch: "exchange_failed",
        destination: "/login?error=invalid",
      })
      return NextResponse.redirect(new URL("/login?error=invalid", request.url))
    }
  } else {
    console.info("[Family onboarding callback] exchangeCodeForSession skipped", {
      reason: "missing_code",
      hasCode: false,
    })
  }

  const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])
  const user = userData.user
  console.info("[Family onboarding callback] auth state after exchange", {
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    emailConfirmedAt: user?.email_confirmed_at ?? null,
    hasSession: Boolean(sessionData.session),
    userError: errorDetails(userError),
    sessionError: errorDetails(sessionError),
  })

  if (token && /^[0-9a-f]{64}$/i.test(token)) {
    console.info("[Family onboarding callback] complete_family_onboarding attempting", {
      userId: user?.id ?? null,
      hasInvitationToken: true,
    })
    const { error } = await supabase.rpc("complete_family_onboarding", {
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    })
    console.info("[Family onboarding callback] complete_family_onboarding result", {
      success: !error,
      hasResult: !error,
      error: errorDetails(error),
    })
    if (error) {
      console.error("[Family onboarding callback] redirecting error", {
        branch: "onboarding_rpc_failed",
        destination: "/login?error=onboarding",
      })
      return NextResponse.redirect(new URL("/login?error=onboarding", request.url))
    }
  } else {
    console.info("[Family onboarding callback] resolvePendingOnboarding attempting", {
      userId: user?.id ?? null,
      hasInvitationToken: Boolean(token),
      hasTokenHash: Boolean(tokenHash),
    })
    try {
      const result = await resolvePendingOnboarding(supabase)
      console.info("[Family onboarding callback] resolvePendingOnboarding result", {
        result,
      })
    } catch (error) {
      console.error("[Family onboarding callback] resolvePendingOnboarding failed", {
        error: errorDetails(error),
      })
      console.error("[Family onboarding callback] redirecting error", {
        branch: "pending_resolution_failed",
        destination: "/login?error=onboarding",
      })
      return NextResponse.redirect(new URL("/login?error=onboarding", request.url))
    }
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  let homeRoute: string | null = null
  try {
    homeRoute = typeof userId === 'string' ? await getHomeRoute(supabase, userId) : null
    console.info("[Family onboarding callback] home route result", {
      success: true,
      userId: typeof userId === 'string' ? userId : null,
      homeRoute,
      claimsError: errorDetails(claimsError),
    })
  } catch (error) {
    console.error("[Family onboarding callback] home route failed", {
      error: errorDetails(error),
    })
    throw error
  }

  if (!homeRoute) {
    console.error("[Family onboarding callback] redirecting error", {
      branch: "home_route_failed",
      destination: "/login?error=unauthorized",
      userId: typeof userId === 'string' ? userId : null,
    })
  }

  return NextResponse.redirect(new URL(homeRoute ?? "/login?error=unauthorized", request.url))
}

function errorDetails(error: unknown) {
  if (!error) return null
  if (error instanceof Error) {
    const supabaseError = error as Error & {
      code?: string
      status?: number
      details?: string
      hint?: string
    }
    return {
      name: supabaseError.name,
      code: supabaseError.code ?? null,
      message: supabaseError.message,
      status: supabaseError.status ?? null,
      details: supabaseError.details ?? null,
      hint: supabaseError.hint ?? null,
    }
  }
  return { valueType: typeof error }
}
