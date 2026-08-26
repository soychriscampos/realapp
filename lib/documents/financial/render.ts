import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import type React from "react"

export function renderFinancialPdf(
  document: React.ReactElement<DocumentProps>
): Promise<Buffer> {
  return renderToBuffer(document)
}
