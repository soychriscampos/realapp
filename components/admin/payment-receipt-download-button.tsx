"use client"

import { Toast } from "@base-ui/react/toast"
import { LoaderCircle } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

type PaymentReceiptDownloadButtonProps = {
  href: string
  children: ReactNode
  className?: string
}

export function PaymentReceiptDownloadButton({
  href,
  children,
  className,
}: PaymentReceiptDownloadButtonProps) {
  const toastManager = Toast.useToastManager()
  const [isLoading, setIsLoading] = useState(false)

  async function downloadReceipt() {
    if (isLoading) return

    setIsLoading(true)

    try {
      const response = await fetch(href)
      if (!response.ok) throw new Error("Payment receipt request failed")

      const pdfBlob = await response.blob()
      const filename = getFilename(response.headers.get("Content-Disposition"))
      const file = new File([pdfBlob], filename, { type: "application/pdf" })
      const canShareFile =
        isStandalone() &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })

      if (canShareFile) {
        try {
          await navigator.share({ files: [file], title: "Comprobante de pago" })
        } catch (error) {
          if (isAbortError(error)) return
          throw error
        }
        return
      }

      downloadBlob(pdfBlob, filename)
    } catch {
      toastManager.add({ title: "No fue posible descargar el comprobante." })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={isLoading}
      onClick={downloadReceipt}
    >
      {isLoading ? <><LoaderCircle className="animate-spin" /> Descargando...</> : children}
    </Button>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function getFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="([^"]+)"/i)
  return match?.[1] ?? "comprobante-pago.pdf"
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function isStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false

  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone
}
