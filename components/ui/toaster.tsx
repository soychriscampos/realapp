"use client"

import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, X } from "lucide-react"
import type { ReactNode } from "react"

export function ToasterProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={4000} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] z-[100] mx-auto flex w-auto max-w-sm flex-col gap-2 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="w-full rounded-lg border border-border bg-white shadow-lg transition data-ending-style:-translate-y-2 data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0"
    >
        <Toast.Content className="flex min-h-14 items-center gap-3 px-3 py-2.5">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-sm font-semibold" />
            <Toast.Description className="mt-0.5 text-xs text-muted-foreground" />
          </div>
          <Toast.Close
            aria-label="Cerrar notificación"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-4" />
          </Toast.Close>
        </Toast.Content>
    </Toast.Root>
  ))
}
