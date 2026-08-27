"use client"

import { Toast } from "@base-ui/react/toast"
import { LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { updateCurrentUserProfile } from "@/app/admin/perfil/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ProfileForm({ displayName, phone, email, roleLabel }: { displayName: string; phone: string | null; email: string | null; roleLabel: string }) {
  const [name, setName] = useState(displayName)
  const [phoneValue, setPhoneValue] = useState(phone ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toastManager = Toast.useToastManager()

  function submit() {
    setError(null)
    if (!name.trim()) {
      setError("Indica tu nombre.")
      return
    }

    startTransition(async () => {
      const result = await updateCurrentUserProfile({ displayName: name, phone: phoneValue })
      if (!result.ok) {
        setError(result.message)
        return
      }

      toastManager.add({ title: "Perfil actualizado", description: "Tus datos fueron guardados." })
      router.refresh()
    })
  }

  return <section className="max-w-2xl space-y-5"><div><h2 className="text-base font-semibold">Datos personales</h2><p className="mt-1 text-sm text-muted-foreground">Actualiza la información básica de tu cuenta.</p></div><div className="space-y-4 border-y border-border bg-white px-4 py-5 sm:px-6"><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></Field><Field label="Teléfono"><Input value={phoneValue} onChange={(event) => setPhoneValue(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="Opcional" /></Field><Field label="Correo"><Input value={email ?? "No disponible"} readOnly aria-readonly="true" /></Field><Field label="Rol"><Input value={roleLabel} readOnly aria-readonly="true" /></Field></div>{error && <p className="border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}<div className="flex justify-end"><Button disabled={isPending} onClick={submit}>{isPending && <LoaderCircle className="animate-spin" />}{isPending ? "Guardando..." : "Guardar cambios"}</Button></div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label>
}
