"use client"

import { Dialog } from "@base-ui/react/dialog"
import { AlertTriangle, Link2Off, LoaderCircle, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { unlinkGuardianFromStudent } from "@/app/admin/alumnos/[id]/family-actions"
import { Button } from "@/components/ui/button"

export function UnlinkGuardianDialog({
  studentId,
  studentName,
  guardianId,
  guardianName,
}: {
  studentId: string
  studentName: string
  guardianId: string
  guardianName: string
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await unlinkGuardianFromStudent({ studentId, guardianId })
      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setOpen(nextOpen)
          if (nextOpen) setError(null)
        }
      }}
    >
      <Dialog.Trigger
        render={
          <Button variant="ghost" size="sm" aria-label={`Desvincular a ${guardianName}`}>
            <Link2Off /> Desvincular
          </Button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col justify-center bg-white p-5 outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(100%-2rem,440px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-border sm:shadow-xl">
          <header className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <AlertTriangle className="size-4" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold">Desvincular tutor</Dialog.Title>
                <p className="mt-1 text-sm text-muted-foreground">Confirma esta operación</p>
              </div>
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              disabled={isPending}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-4" />
            </Dialog.Close>
          </header>

          <p className="mt-5 text-sm leading-6">
            Se desvinculará a <strong>{guardianName}</strong> de <strong>{studentName}</strong>. Si tiene acceso al portal familiar para este alumno, dicho acceso también será revocado. Sus datos y relaciones con otros alumnos se conservarán.
          </p>

          {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}

          <footer className="mt-6 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="ghost" disabled={isPending}>Cancelar</Button>} />
            <Button variant="destructive" disabled={isPending} onClick={submit}>
              {isPending && <LoaderCircle className="animate-spin" />}
              {isPending ? "Desvinculando..." : "Desvincular tutor"}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
