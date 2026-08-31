'use client'

import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  initialNewPasswordState,
  saveNewPassword,
  type NewPasswordState,
} from './actions'

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

function SavePasswordSubmit() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="h-12 w-full" disabled={pending}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Guardando' : 'Guardar contraseña'}
    </Button>
  )
}

export function NewPasswordForm() {
  const [state, formAction] = useActionState<NewPasswordState, FormData>(
    saveNewPassword,
    initialNewPasswordState
  )
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  function validate(event: React.FormEvent<HTMLFormElement>) {
    setClientError(null)

    if (password !== confirmation) {
      event.preventDefault()
      setClientError('Las contraseñas no coinciden.')
    }
  }

  const error = clientError ?? state.error

  return (
    <form action={formAction} onSubmit={validate} className="space-y-5">
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

      <SavePasswordSubmit />
    </form>
  )
}
