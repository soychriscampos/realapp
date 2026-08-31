import Image from 'next/image'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordRecovery } from './actions'
import { RecoverySubmit } from './recovery-submit'

type RecoveryPageProps = {
  searchParams: Promise<{
    sent?: string
    error?: string
  }>
}

export default async function PasswordRecoveryPage({
  searchParams,
}: RecoveryPageProps) {
  const { sent, error } = await searchParams

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
            Restablecer contraseña
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Te enviaremos un enlace a tu correo.
          </p>
        </div>

        {sent === '1' ? (
          <div className="space-y-5">
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground">
              Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
            </p>

            <Link
              href="/login"
              className="block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form action={requestPasswordRecovery} className="space-y-5">
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

            {error === 'invalid-link' && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo.
              </p>
            )}

            <RecoverySubmit />

            <Link
              href="/login"
              className="block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
