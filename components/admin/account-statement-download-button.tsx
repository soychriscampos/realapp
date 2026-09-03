"use client"

import { Toast } from "@base-ui/react/toast"
import { Download, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function AccountStatementDownloadButton({ href }: { href: string }) {
  const toastManager = Toast.useToastManager()
  const [isLoading, setIsLoading] = useState(false)

  async function downloadStatement() {
    if (isLoading) return

    setIsLoading(true)
    try {
      const response = await fetch(href)
      if (!response.ok) throw new Error("Account statement request failed")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = getFilename(response.headers.get("Content-Disposition"))
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toastManager.add({ title: "No fue posible descargar el estado de cuenta." })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 w-full sm:w-auto"
      disabled={isLoading}
      onClick={downloadStatement}
    >
      {isLoading ? <><LoaderCircle className="animate-spin" /> Descargando...</> : <><Download /> Descargar</>}
    </Button>
  )
}

function getFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="([^"]+)"/i)
  return match?.[1] ?? "estado-de-cuenta.pdf"
}
