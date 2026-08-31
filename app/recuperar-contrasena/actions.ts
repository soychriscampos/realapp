'use server'

import { redirect } from 'next/navigation'
import { getSiteUrl } from '@/lib/site/url'
import { createPublicClient } from '@/lib/supabase/server'

export async function requestPasswordRecovery(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()

  if (email) {
    const supabase = createPublicClient()

    // La respuesta siempre es idéntica para no revelar si el correo existe.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/recovery/callback`,
    })
  }

  redirect('/recuperar-contrasena?sent=1')
}
