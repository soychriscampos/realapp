import { ChevronRight, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { QuickAction } from "@/components/admin/admin-shell"
import {
  attentionItems,
  homeSummary,
  recentPayments,
} from "@/components/admin/admin-home-mocks"

export default function AdminPage() {
  return (
    <div className="space-y-7">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground lg:hidden">
          Ciclo 2026-2027
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">
          Inicio
        </h1>
        <p className="hidden text-sm text-muted-foreground lg:block">
          Ciclo 2026-2027
        </p>
      </header>

      <section aria-labelledby="student-search" className="space-y-3">
        <h2 id="student-search" className="text-base font-semibold">
          Buscar alumno
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nombre del alumno..."
            aria-label="Nombre del alumno"
            className="h-12 bg-white pl-11 text-base"
          />
        </div>
      </section>

      <section aria-labelledby="quick-actions" className="space-y-3">
        <h2 id="quick-actions" className="text-base font-semibold">
          Acciones rápidas
        </h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:max-w-3xl">
          <QuickAction icon="payment" label="Registrar pago" />
          <QuickAction icon="enrollment" label="Nueva preinscripción" />
          <QuickAction icon="student" label="Buscar alumno" />
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-7">
          <section aria-labelledby="attention" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="attention" className="text-base font-semibold">
                Requieren atención
              </h2>
              <button className="min-h-9 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                Ver todos
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-white">
              {attentionItems.map((item, index) => (
                <button
                  key={item.student}
                  className="flex min-h-[72px] w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {item.student}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {item.grade}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-sm font-medium">
                    <span
                      className={
                        index === 2
                          ? "text-amber-700"
                          : "text-destructive"
                      }
                    >
                      {item.status}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="recent-payments" className="space-y-3">
            <h2 id="recent-payments" className="text-base font-semibold">
              Pagos recientes
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-white">
              {recentPayments.map((payment) => (
                <button
                  key={`${payment.student}-${payment.time}`}
                  className="flex min-h-[68px] w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {payment.student}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {payment.amount} · {payment.method}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                    {payment.time}
                    <ChevronRight className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside aria-label="Resumen del día" className="space-y-3">
          <h2 className="text-base font-semibold">Hoy</h2>
          <div className="rounded-xl border border-border bg-white">
            {homeSummary.map((item) => (
              <div
                key={item.label}
                className="border-b border-border px-4 py-4 last:border-b-0"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
