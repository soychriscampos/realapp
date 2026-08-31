'use client'

import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const MINIMUM_PASSWORD_LENGTH = 6

function PasswordInput({
  id,
  label,
  value,
  onChange,
}: {
  id: 'password' | 'confirmation'
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={isVisible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={MINIMUM_PASSWORD_LENGTH}
          className="h-12 pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
  )
}

export function NewPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsPending(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError('No pudimos actualizar tu contraseña. Intenta de nuevo.')
        return
      }

      const completionResponse = await fetch('/auth/recovery/complete', {
        method: 'POST',
      })

      if (!completionResponse.ok) {
        setError('No pudimos completar el restablecimiento. Intenta de nuevo.')
        return
      }

      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        setError('No pudimos cerrar la sesión. Intenta de nuevo.')
        return
      }

      // Se requiere una navegación completa para cerrar este flujo fuera de
      // Server Actions y descartar el estado del router de recovery.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login?password_reset=1')
    } catch {
      setError('No pudimos completar el restablecimiento. Intenta de nuevo.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={savePassword} className="space-y-5">
      <PasswordInput
        id="password"
        label="Nueva contraseña"
        value={password}
        onChange={setPassword}
      />
      <PasswordInput
        id="confirmation"
        label="Confirmar contraseña"
        value={confirmation}
        onChange={setConfirmation}
      />

      <p className="text-sm text-muted-foreground">
        Usa al menos {MINIMUM_PASSWORD_LENGTH} caracteres.
      </p>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="h-12 w-full" disabled={isPending}>
        {isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? 'Guardando' : 'Guardar contraseña'}
      </Button>
    </form>
  )
}
