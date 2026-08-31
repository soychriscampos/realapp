'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const RECOVERY_COOKIE = 'real-password-recovery'
const MINIMUM_PASSWORD_LENGTH = 6

export type NewPasswordState = {
  error: string | null
}

export const initialNewPasswordState: NewPasswordState = {
  error: null,
}

export async function saveNewPassword(
  _previousState: NewPasswordState,
  formData: FormData
): Promise<NewPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  const cookieStore = await cookies()

  if (cookieStore.get(RECOVERY_COOKIE)?.value !== '1') {
    return { error: 'Tu enlace de recuperación no es válido o ya venció. Solicita uno nuevo.' }
  }

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.` }
  }

  if (password !== confirmation) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Tu enlace de recuperación no es válido o ya venció. Solicita uno nuevo.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    return { error: 'No pudimos actualizar tu contraseña. Intenta de nuevo.' }
  }

  const { error: signOutError } = await supabase.auth.signOut()

  if (signOutError) {
    return { error: 'No pudimos cerrar la sesión. Intenta de nuevo.' }
  }

  cookieStore.delete(RECOVERY_COOKIE)
  redirect('/login?password_reset=1')
}
