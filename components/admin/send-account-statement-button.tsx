"use client"

import { Toast } from "@base-ui/react/toast"
import { LoaderCircle, Mail } from "lucide-react"
import { useTransition } from "react"

import { sendAccountStatementEmail } from "@/app/admin/alumnos/[id]/account-actions"
import { Button } from "@/components/ui/button"

type SendAccountStatementButtonProps = {
  studentId: string
  hasRecipients: boolean
}

export function SendAccountStatementButton({ studentId, hasRecipients }: SendAccountStatementButtonProps) {
  const [isPending, startTransition] = useTransition()
  const toastManager = Toast.useToastManager()

  function handleSend() {
    if (!hasRecipients || isPending) return

    startTransition(async () => {
      const result = await sendAccountStatementEmail(studentId)

      if (result.ok) {
        toastManager.add({ title: "Estado de cuenta enviado por correo." })
        return
      }

      if (result.reason === "NO_RECIPIENTS") {
        toastManager.add({ title: "No hay un correo habilitado para este alumno." })
        return
      }

      toastManager.add({ title: "No fue posible enviar el estado de cuenta." })
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="h-10 w-full sm:w-auto"
        disabled={!hasRecipients || isPending}
        onClick={handleSend}
        title={!hasRecipients ? "No hay un correo habilitado para este alumno." : undefined}
      >
        {isPending ? <LoaderCircle className="animate-spin" /> : <Mail />}
        {isPending ? "Enviando..." : "Enviar por correo"}
      </Button>
      {!hasRecipients && <p className="text-xs text-muted-foreground">Sin correo disponible</p>}
    </div>
  )
}
