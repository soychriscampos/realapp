export default function StudentsLoading() {
  return (
    <div className="space-y-6" aria-label="Cargando alumnos">
      <div className="space-y-2">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-11 animate-pulse rounded-lg bg-muted" />
      <div className="h-11 w-28 animate-pulse rounded-lg bg-muted" />
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="space-y-2 border-b border-border px-4 py-4 last:border-b-0">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
