"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import {
  Banknote,
  BarChart3,
  ChevronRight,
  Home,
  LogOut,
  MenuIcon,
  PlusCircle,
  Search,
  Settings,
  Users,
  UserRound,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { ToasterProvider } from "@/components/ui/toaster"
import { StudentQuickSearch } from "@/components/admin/student-quick-search"
import { cn } from "@/lib/utils"

type AdminShellProps = {
  children: ReactNode
  roleLabel: string
  userName: string | null
  canManageUsers?: boolean
}

const primaryNavigation = [
  { label: "Inicio", href: "/admin", icon: Home },
  { label: "Alumnos", href: "/admin/alumnos", icon: Users },
  { label: "Reportes", href: "/admin/reportes", icon: BarChart3 },
  { label: "Usuarios", href: "/admin/usuarios", icon: UserRound },
  { label: "Configuración", href: "/admin/configuracion", icon: Settings },
]

const mobileNavigation = [
  { label: "Inicio", href: "/admin", icon: Home },
  { label: "Alumnos", href: "/admin/alumnos", icon: Users },
]

export function AdminShell({ children, roleLabel, userName, canManageUsers = false }: AdminShellProps) {
  const pathname = usePathname()
  const showDesktopSearch = pathname !== "/admin"
  const navigation = canManageUsers ? primaryNavigation : primaryNavigation.filter((item) => item.label !== "Usuarios")

  return (
    <ToasterProvider>
      <div className="min-h-dvh bg-[#f7f7f8] text-foreground">
        <div className="hidden min-h-dvh lg:flex">
        <aside className="flex w-[232px] shrink-0 flex-col bg-white">
          <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <Image src="/logo-real.png" alt="REAL" width={32} height={32} className="size-7 object-contain" priority />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Colegio REAL
                </span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 space-y-5 border-r border-border px-3 py-4">
            <NavigationGroup items={navigation.slice(0, 1)} />
            <NavigationGroup
              label="Gestión"
              items={navigation.slice(1, 2)}
            />
            <NavigationGroup
              label="Operación"
              items={navigation.slice(2, 3)}
            />
            <NavigationGroup
              label="Sistema"
              items={navigation.slice(3)}
            />
          </nav>

          <div className="border-t border-r border-border p-3">
            <UserMenu roleLabel={roleLabel} userName={userName} align="top" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-end border-b border-border bg-white px-6">
            <div className={cn(
              "flex w-full max-w-[1480px] items-center gap-4",
              showDesktopSearch ? "justify-between" : "justify-end"
            )}>
              {showDesktopSearch && (
                <div className="w-full max-w-sm">
                  <StudentQuickSearch compact />
                </div>
              )}
              <UserMenu roleLabel={roleLabel} userName={userName} compact />
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
              <Image src="/logo-real.png" alt="REAL" width={32} height={32} className="size-7 object-contain" priority />
            </div>
            <UserMenu roleLabel={roleLabel} userName={userName} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5">
          {children}
        </main>

        <MobileBottomNavigation navigation={navigation} />
        </div>
      </div>
    </ToasterProvider>
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
  const isActive = item.href === "/admin"
    ? pathname === item.href
    : pathname.startsWith(item.href) || (
      item.href === "/admin/alumnos" && pathname.startsWith("/admin/matricula")
    )
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        compact
          ? "min-h-11 w-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px]"
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
  userName,
  align = "bottom",
  compact = false,
}: {
  roleLabel: string
  userName: string | null
  align?: "top" | "bottom"
  compact?: boolean
}) {
  const displayName = userName?.trim() || "Usuario REAL"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "flex shrink-0 items-center rounded-lg text-left text-sm outline-none transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "min-h-9 gap-2 px-1" : "min-h-11 gap-2 px-2"
        )}
        aria-label="Abrir menú de usuario"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {initial}
        </span>
        <span
          className={cn(
            "hidden min-w-0 sm:flex",
            "flex-col"
          )}
        >
          <span className="truncate font-medium">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side={align} align="end" sideOffset={8}>
          <Menu.Popup className="z-50 min-w-56 rounded-xl border border-border bg-white p-1 shadow-lg outline-none">
            <div className="px-2 py-2">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              render={<Link href="/admin/perfil" className="flex h-9 items-center rounded-lg px-2 text-sm outline-none hover:bg-muted" />}
            >
              Mi perfil
            </Menu.Item>
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

function MobileBottomNavigation({ navigation }: { navigation: typeof primaryNavigation }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid min-h-16 max-w-md grid-cols-3 items-center justify-items-center gap-1">
        {mobileNavigation.map((item) => (
          <NavigationItem key={item.href} item={item} compact />
        ))}
        <MoreSheet items={navigation.filter((item) => !["Inicio", "Alumnos"].includes(item.label))} />
      </div>
    </nav>
  )
}

function MoreSheet({ items }: { items: typeof primaryNavigation }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
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
              {items.map((item) => {
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
  searchTarget,
}: {
  icon: "payment" | "student" | "enrollment"
  label: string
  searchTarget?: string
}) {
  const Icon =
    icon === "payment" ? Banknote : icon === "student" ? Search : PlusCircle

  return (
    <Button
      type="button"
      className="h-10 min-w-44 justify-center gap-2 px-3 text-sm"
      onClick={() => {
        if (!searchTarget) return
        const target = Array.from(
          document.querySelectorAll<HTMLInputElement>("[data-search-target]")
        ).find(
          (input) =>
            input.dataset.searchTarget === searchTarget &&
            input.getBoundingClientRect().width > 0
        )
        target?.scrollIntoView({ behavior: "smooth", block: "center" })
        target?.focus()
      }}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  )
}
