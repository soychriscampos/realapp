import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHomeRoute } from '@/lib/auth/home-route'
import { login } from './actions'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
          : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Colegio REAL
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa a tu cuenta
          </p>
        </div>

        <form action={login} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>

            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>

            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <Button type="submit" className="w-full">
            Iniciar sesión
          </Button>
        </form>
      </div>
    </main>
  )
}