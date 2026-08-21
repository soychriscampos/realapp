import type { Metadata } from "next"
import { Geist } from "next/font/google"

import { cn } from "@/lib/utils"

import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "REAL",
  description: "Colegio REAL de Escuinapa",
}

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={cn("h-full", "antialiased", "font-sans", geist.variable)}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}