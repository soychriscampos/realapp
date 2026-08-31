'use client'

import { LoaderCircle } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function RecoverySubmit() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="h-12 w-full" disabled={pending}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Enviando' : 'Enviar enlace'}
    </Button>
  )
}
