import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { AdminHomeRecentPayments } from "@/components/admin/admin-home-recent-payments"
import { NewEnrollmentSheet } from "@/components/admin/new-enrollment-sheet"
import { StudentQuickSearch } from "@/components/admin/student-quick-search"
import { getAdminHomeData } from "@/lib/admin/admin-home"
import { getEnrollmentFinancialCoverage } from "@/lib/admin/enrollments"
import { formatCurrency } from "@/lib/admin/student-account"
import { getTuitionDiscountCategories } from "@/lib/admin/discount-categories"
import { getStudentCatalogs } from "@/lib/admin/students"
import { requireRole } from "@/lib/auth/require-role"

export default async function AdminPage() {
  const { supabase, userId, roles } = await requireRole(["MASTER", "ADMINISTRATIVO"])
  const { catalogs, error: catalogsError } = await getStudentCatalogs(supabase)

  if (catalogsError || !catalogs?.operationalCycle) return <AdminLoadError />

  const cycle = catalogs.operationalCycle
  const [groupsResult, financialCoverageResult, discountCategoriesResult, home] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, code, cycle_id, grade_level_id")
      .eq("is_active", true)
      .order("name"),
    getEnrollmentFinancialCoverage(supabase),
    getTuitionDiscountCategories(supabase, cycle.id),
    getAdminHomeData(supabase, userId, roles.includes("MASTER"), {
      id: cycle.id,
    }),
  ])

  if (groupsResult.error || financialCoverageResult.error || discountCategoriesResult.error) return <AdminLoadError />

  const isMaster = roles.includes("MASTER")

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">Inicio</h1>
          <p className="text-sm text-muted-foreground">{cycle.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewEnrollmentSheet
            cycles={catalogs.cycles}
            operationalCycleId={cycle.id}
            levels={catalogs.levels}
            grades={catalogs.grades}
            groups={groupsResult.data ?? []}
            classifications={catalogs.classifications}
            financialCoverage={financialCoverageResult.data}
            discountCategories={discountCategoriesResult.data}
            triggerLabel="Nueva matrícula"
            triggerClassName="w-full min-w-44 sm:w-auto"
          />
        </div>
      </header>

      <section aria-labelledby="student-search" className="space-y-3">
        <h2 id="student-search" className="text-base font-semibold">Buscar alumno</h2>
        <StudentQuickSearch cycleId={cycle.id} focusTarget="register-payment" />
      </section>

      {home.hasError && (
        <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-muted-foreground">
          No pudimos actualizar algunos datos del inicio. Intenta recargar la página.
        </p>
      )}

      <aside aria-label="Resumen del día" className="space-y-3">
        <h2 className="text-base font-semibold">Hoy</h2>
        <div className="rounded-xl border border-border bg-white">
          <SummaryItem label="Pagos del día" value={formatCurrency(home.paymentsToday)} />
          <SummaryItem label="Saldo vencido del ciclo" value={formatCurrency(home.overdueTotal)} />
          <SummaryItem label="Alumnos pendientes" value={String(home.pendingStudents)} />
        </div>
      </aside>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-7">
          <section aria-labelledby="attention" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="attention" className="text-base font-semibold">Requieren atención</h2>
              <Link
                href="/admin/alumnos/adeudos"
                className="min-h-9 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Ver todos
              </Link>
            </div>
            {home.overdueItems.length === 0 ? (
              <div className="rounded-xl border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                No hay alumnos con saldo vencido en este ciclo.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                {home.overdueItems.map((item) => (
                  <Link
                    key={item.studentId}
                    href={`/admin/alumnos/${item.studentId}`}
                    className="flex min-h-[72px] items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.studentName}</span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {item.gradeName}{item.groupName ? ` · ${item.groupName}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm font-medium text-destructive">
                      {formatCurrency(item.overdueAmount)} vencido
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="recent-payments" className="space-y-3">
            <h2 id="recent-payments" className="text-base font-semibold">Pagos recientes</h2>
            <AdminHomeRecentPayments payments={home.recentPayments} isMaster={isMaster} />
          </section>
        </div>

      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function AdminLoadError() {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
      No pudimos cargar el inicio administrativo. Intenta recargar la página.
    </div>
  )
}
