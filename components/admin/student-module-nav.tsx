"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const items = [
  { label: "Alumnos", href: "/admin/alumnos" },
  { label: "Matrícula", href: "/admin/matricula" },
  { label: "Adeudos", href: "/admin/alumnos/adeudos" },
]

export function StudentModuleNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Sección de alumnos" className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
