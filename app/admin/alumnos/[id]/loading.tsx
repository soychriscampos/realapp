export default function StudentDetailLoading() {
  return (
    <div className="space-y-7" aria-label="Cargando alumno">
      <div className="h-9 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-11 animate-pulse border-b border-border bg-muted" />
      <div className="grid gap-7 xl:grid-cols-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="space-y-4 rounded-xl border border-border bg-white p-5">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
