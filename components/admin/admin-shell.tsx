"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import {
  Banknote,
  BarChart3,
  BookOpen,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Home,
  LogOut,
  MenuIcon,
  PlusCircle,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AdminShellProps = {
  children: ReactNode
  roleLabel: string
}

const primaryNavigation = [
  { label: "Inicio", href: "/admin", icon: Home },
  { label: "Alumnos", href: "/admin/alumnos", icon: Users },
  { label: "Matrícula", href: "/admin/matricula", icon: GraduationCap },
  { label: "Pagos", href: "/admin/pagos", icon: CreditCard },
  { label: "Académico", href: "/admin/academico", icon: BookOpen },
  { label: "Reportes", href: "/admin/reportes", icon: BarChart3 },
  { label: "Configuración", href: "/admin/configuracion", icon: Settings },
]

const mobileNavigation = [
  { label: "Inicio", href: "/admin", icon: Home },
  { label: "Alumnos", href: "/admin/alumnos", icon: Users },
  { label: "Pagos", href: "/admin/pagos", icon: CreditCard },
]

const moreNavigation = primaryNavigation.filter(
  (item) => !["Inicio", "Alumnos", "Pagos"].includes(item.label)
)

export function AdminShell({ children, roleLabel }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-foreground">
      <div className="hidden min-h-dvh lg:flex">
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-white">
          <div className="border-b border-border px-5 py-5">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold">
                REAL
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  Colegio REAL
                </span>
                <span className="block text-xs text-muted-foreground">
                  Ciclo 2026-2027
                </span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 space-y-5 px-3 py-4">
            <NavigationGroup items={primaryNavigation.slice(0, 1)} />
            <NavigationGroup
              label="Gestión"
              items={primaryNavigation.slice(1, 4)}
            />
            <NavigationGroup
              label="Operación"
              items={primaryNavigation.slice(4, 6)}
            />
            <NavigationGroup
              label="Sistema"
              items={primaryNavigation.slice(6)}
            />
          </nav>

          <div className="border-t border-border p-3">
            <UserMenu roleLabel={roleLabel} align="top" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-end border-b border-border bg-white px-6">
            <div className="flex w-full max-w-[1480px] items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  aria-label="Buscar alumno"
                  placeholder="Buscar alumno..."
                  className="h-9 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
                />
              </div>
              <UserMenu roleLabel={roleLabel} />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-6 py-6">
            <div className="mx-auto w-full max-w-[1480px]">{children}</div>
          </main>
        </div>
      </div>

      <div className="flex min-h-dvh flex-col lg:hidden">
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 backdrop-blur">
          <div className="flex min-h-14 items-center justify-between gap-3 pt-[env(safe-area-inset-top)]">
            <div>
              <p className="text-sm font-semibold">REAL</p>
              <p className="text-xs text-muted-foreground">
                Ciclo 2026-2027
              </p>
            </div>
            <UserMenu roleLabel={roleLabel} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5">
          {children}
        </main>

        <MobileBottomNavigation />
      </div>
    </div>
  )
}

function NavigationGroup({
  label,
  items,
}: {
  label?: string
  items: typeof primaryNavigation
}) {
  return (
    <div className="space-y-1">
      {label && (
        <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      {items.map((item) => (
        <NavigationItem key={item.href} item={item} />
      ))}
    </div>
  )
}

function NavigationItem({
  item,
  compact = false,
}: {
  item: (typeof primaryNavigation)[number]
  compact?: boolean
}) {
  const pathname = usePathname()
  const isActive =
    item.href === "/admin"
      ? pathname === item.href
      : pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        compact
          ? "min-h-11 flex-col justify-center gap-1 px-2 text-[11px]"
          : "h-10 px-3",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="size-4" />
      <span>{item.label}</span>
    </Link>
  )
}

function UserMenu({
  roleLabel,
  align = "bottom",
}: {
  roleLabel: string
  align?: "top" | "bottom"
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm outline-none transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Abrir menú de usuario"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          R
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate font-medium">Usuario REAL</span>
          <span className="block truncate text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side={align} align="end" sideOffset={8}>
          <Menu.Popup className="z-50 min-w-56 rounded-xl border border-border bg-white p-1 shadow-lg outline-none">
            <div className="px-2 py-2">
              <p className="text-sm font-medium">Usuario REAL</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <form action="/auth/signout" method="post">
              <button className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-destructive outline-none transition hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/20">
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function MobileBottomNavigation() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid min-h-16 max-w-md grid-cols-4 items-center gap-1">
        {mobileNavigation.map((item) => (
          <NavigationItem key={item.href} item={item} compact />
        ))}
        <MoreSheet />
      </div>
    </nav>
  )
}

function MoreSheet() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <MenuIcon className="size-4" />
        <span>Más</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-sm flex-col border-l border-border bg-white shadow-lg outline-none">
          <div className="flex min-h-14 items-center justify-between border-b border-border px-4 pt-[env(safe-area-inset-top)]">
            <Dialog.Title className="text-sm font-semibold">REAL</Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar menú"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <Dialog.Description className="sr-only">
              Navegación secundaria administrativa
            </Dialog.Description>
            <div className="space-y-1">
              {moreNavigation.map((item) => {
                const Icon = item.icon

                return (
                  <Dialog.Close
                    key={item.href}
                    nativeButton={false}
                    render={
                      <Link
                        href={item.href}
                        className="flex min-h-12 items-center justify-between rounded-lg px-3 text-sm font-medium outline-none transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="size-4 text-muted-foreground" />
                          {item.label}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    }
                  />
                )
              })}
            </div>
          </div>

          <div className="border-t border-border p-3">
            <form action="/auth/signout" method="post">
              <Button
                type="submit"
                variant="ghost"
                className="h-11 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function QuickAction({
  icon,
  label,
}: {
  icon: "payment" | "student" | "enrollment"
  label: string
}) {
  const Icon =
    icon === "payment" ? Banknote : icon === "student" ? Search : PlusCircle

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 justify-start gap-3 bg-white px-3 text-sm"
    >
      <Icon className="size-4" />
      {label}
    </Button>
  )
}
