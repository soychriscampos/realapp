import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { NewPasswordForm } from './new-password-form'

const RECOVERY_COOKIE = 'real-password-recovery'

export default async function NewPasswordPage() {
  const cookieStore = await cookies()
  const hasRecoveryFlow = cookieStore.get(RECOVERY_COOKIE)?.value === '1'

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!hasRecoveryFlow || error || !user) {
    redirect('/recuperar-contrasena?error=invalid-link')
  }

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
            Nueva contraseña
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Elige una contraseña nueva para tu cuenta.
          </p>
        </div>

        <NewPasswordForm />
      </div>
    </main>
  )
}
