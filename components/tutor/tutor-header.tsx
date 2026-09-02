"use client"

import { Menu } from "@base-ui/react/menu"
import { LogOut } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function TutorHeader({ name }: { name: string | null }) {
  const displayName = name?.trim().split(/\s+/)[0] || "Usuario"
  return <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 backdrop-blur"><div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-3"><Link href="/tutor" className="flex min-w-0 items-center gap-2.5"><Image src="/logo-real.png" alt="Colegio REAL" width={32} height={32} className="size-8 object-contain" priority /><span className="min-w-0"><span className="block truncate text-sm font-semibold">Colegio REAL</span><span className="block truncate text-xs text-muted-foreground">Portal familiar</span></span></Link><Menu.Root><Menu.Trigger className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Abrir menú de usuario"><span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{displayName.charAt(0).toUpperCase()}</span><span className="hidden max-w-40 truncate sm:block">{displayName}</span></Menu.Trigger><Menu.Portal><Menu.Positioner align="end" sideOffset={8}><Menu.Popup className="z-50 min-w-44 rounded-xl border border-border bg-white p-1 shadow-lg outline-none"><form action="/auth/signout" method="post"><button className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/20"><LogOut className="size-4" />Cerrar sesión</button></form></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></div></header>
}
