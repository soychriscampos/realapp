import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function ReportsPage() {
  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta información operativa y escolar del colegio.
        </p>
      </header>

      <div className="divide-y divide-border border-y border-border bg-white">
        <Link
          href="/admin/reportes/matricula"
          className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span>
            <span className="block text-sm font-semibold">Matrícula</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Consulta la matrícula por ciclo y fecha de corte.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <Link
          href="/admin/reportes/financieros"
          className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span>
            <span className="block text-sm font-semibold">Financieros</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Consulta ingresos netos por periodo, método y receptor.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </div>
  )
}
