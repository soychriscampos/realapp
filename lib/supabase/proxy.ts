import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicAuthRoute =
    pathname === '/onboarding/staff' ||
    pathname === '/recuperar-contrasena' ||
    pathname === '/nueva-contrasena' ||
    pathname === '/auth/recovery/callback'

  // Estas rutas públicas no deben intentar refrescar cookies de Auth. En
  // particular, el callback crea su propia sesión y las pantallas públicas
  // siguen siendo accesibles aun con cookies inválidas o vencidas.
  if (isPublicAuthRoute) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )

          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Valida/refresca la sesión.
  await supabase.auth.getClaims()

  return supabaseResponse
}
