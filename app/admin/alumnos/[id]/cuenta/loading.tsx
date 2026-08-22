export default function StudentAccountLoading() {
  return (
    <div className="space-y-7" aria-label="Cargando estado de cuenta">
      <div className="h-9 w-44 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-4 border-y border-border bg-white px-4 py-5 sm:rounded-xl sm:border">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-10 w-44 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-12 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="flex gap-2 border-b border-border pb-2">
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-3 border-y border-border py-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-3 border-y border-border py-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
