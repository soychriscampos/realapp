import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getHomeRoute } from '@/lib/auth/home-route'
import { login } from './actions'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from './password-field'
import { LoginSubmit } from './login-submit'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const supabase = await createClient()

  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (userId) {
    const homeRoute = await getHomeRoute(supabase, userId)

    if (homeRoute) {
      redirect(homeRoute)
    }
  }

  const { error } = await searchParams

  const errorMessage =
    error === 'invalid'
      ? 'Correo o contraseña incorrectos.'
      : error === 'missing'
        ? 'Ingresa tu correo y contraseña.'
      : error === 'unauthorized'
        ? 'Tu cuenta no tiene acceso activo al sistema.'
        : error === 'onboarding'
          ? 'Confirmamos tu correo, pero no pudimos terminar de configurar tu acceso. Intenta de nuevo o contacta al administrador.'
          : null

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f7f8] px-5 py-10 sm:px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center">
            <Image
              src="/logo-real.png"
              alt="REAL"
              width={56}
              height={56}
              className="size-14 object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa a tu cuenta de REAL
          </p>
        </div>

        <form action={login} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>

            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <PasswordField />
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <LoginSubmit />

          <p className="text-center text-sm text-muted-foreground">
            ¿Olvidaste tu contraseña?
          </p>
        </form>
      </div>
    </main>
  )
}
