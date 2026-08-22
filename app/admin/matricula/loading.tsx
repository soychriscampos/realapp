export default function EnrollmentLoading() {
  return (
    <div className="space-y-6" aria-label="Cargando matrículas">
      <div className="flex items-start justify-between"><div className="space-y-2"><div className="h-7 w-28 animate-pulse rounded bg-muted" /><div className="h-4 w-44 animate-pulse rounded bg-muted" /></div><div className="h-10 w-36 animate-pulse rounded-lg bg-muted" /></div>
      <div className="h-10 w-52 animate-pulse rounded-lg bg-muted" />
      <div className="h-11 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="overflow-hidden rounded-xl border border-border bg-white">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="space-y-2 border-b border-border px-4 py-4 last:border-b-0"><div className="h-4 w-48 animate-pulse rounded bg-muted" /><div className="h-3 w-32 animate-pulse rounded bg-muted" /></div>)}</div>
    </div>
  )
}
