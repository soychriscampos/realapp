import Link from "next/link"

export function TutorNavigation({ current, studentId, cycleId }: { current: "home" | "info" | "finance"; studentId?: string; cycleId?: string }) {
  const items = [{ href: "/tutor", label: "Inicio", key: "home" }, { href: "/tutor/informacion", label: "Información", key: "info" }, { href: "/tutor/finanzas", label: "Finanzas", key: "finance" }] as const
  const query = new URLSearchParams(); if (studentId) query.set("student", studentId); if (cycleId) query.set("cycle", cycleId); const suffix = query.toString() ? `?${query}` : ""
  return <nav aria-label="Navegación familiar" className="flex gap-1 overflow-x-auto border-b border-border pb-px">{items.map((item) => <Link key={item.key} href={`${item.href}${suffix}`} className={current === item.key ? "shrink-0 border-b-2 border-foreground px-3 py-3 text-sm font-medium" : "shrink-0 px-3 py-3 text-sm text-muted-foreground hover:text-foreground"}>{item.label}</Link>)}</nav>
}
