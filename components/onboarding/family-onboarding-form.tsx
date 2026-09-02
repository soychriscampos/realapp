"use client"

import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { getSiteUrl } from "@/lib/site/url"

export function FamilyOnboardingForm({ token, students }: { token: string; students: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [visible, setVisible] = useState(false); const [confirmationVisible, setConfirmationVisible] = useState(false); const [mode, setMode] = useState<"signup" | "login">("signup"); const [done, setDone] = useState(false); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false)
  async function completeInvitation() {
    const { error: completionError } = await createClient().rpc("complete_family_onboarding", { p_token_hash: await hashToken(token) })
    if (completionError) {
      setError("No pudimos completar tu acceso familiar. El enlace puede haber expirado o ya no estar disponible.")
      return false
    }
    router.push("/tutor")
    return true
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Captura un correo válido.")
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.")
    if (mode === "signup" && password !== confirmation) return setError("Las contraseñas no coinciden.")

    setPending(true)
    try {
      if (mode === "login") {
        const { error: loginError } = await createClient().auth.signInWithPassword({ email: email.trim(), password })
        if (loginError) {
          setError("El correo o la contraseña no son correctos.")
          return
        }
        await completeInvitation()
        return
      }

      const { data: signupData, error: signupError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${getSiteUrl()}/auth/familia/callback?token=${encodeURIComponent(token)}` },
      })
      if (signupError) {
        if (/already|registered|exists|existe|registrado/i.test(signupError.message)) {
          setMode("login")
          setError("Ya existe una cuenta con este correo. Inicia sesión para completar tu acceso familiar.")
        } else setError("No pudimos registrar ese correo. Verifica los datos o intenta con otro.")
        return
      }
      if (signupData.user?.identities && signupData.user.identities.length === 0) {
        setMode("login")
        setError("Ya existe una cuenta con este correo. Inicia sesión para completar tu acceso familiar.")
        return
      }
      setDone(true)
    } catch {
      setError("No pudimos conectar con el servicio de acceso. Intenta de nuevo.")
    } finally {
      setPending(false)
    }
  }
  if (done) return <div className="rounded-xl border border-border bg-white p-5"><h2 className="font-semibold">Revisa tu correo para confirmar tu cuenta.</h2><p className="mt-2 text-sm text-muted-foreground">Hemos enviado la confirmación a <strong className="font-medium text-foreground">{email.trim()}</strong>. Después de confirmar, tu acceso quedará listo y podrás entrar a la plataforma del colegio.</p></div>
  return <form noValidate onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-white p-5"><div><p className="text-sm font-medium">Alumnos autorizados</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{students.map((student) => <li key={student.id}>{student.name}</li>)}</ul></div><Field label="Correo"><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Contraseña"><div className="relative"><Input type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="pr-11" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button></div></Field>{mode === "signup" && <Field label="Confirmar contraseña"><div className="relative"><Input type={confirmationVisible ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="pr-11" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={confirmationVisible ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"} onClick={() => setConfirmationVisible(!confirmationVisible)}>{confirmationVisible ? <EyeOff /> : <Eye />}</Button></div></Field>}{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} {pending ? (mode === "login" ? "Iniciando sesión…" : "Creando acceso…") : (mode === "login" ? "Iniciar sesión y continuar" : "Crear acceso")}</Button>{mode === "signup" ? <button type="button" className="w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setMode("login"); setError(null) }}>Ya tengo una cuenta</button> : <button type="button" className="w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setMode("signup"); setError(null) }}>Crear una cuenta nueva</button>}</form>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</Label> }

async function hashToken(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
