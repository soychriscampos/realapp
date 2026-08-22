import Link from "next/link"

export default function StudentNotFound() {
  return (
    <div className="border-y border-border bg-white px-4 py-10">
      <h1 className="text-lg font-semibold">No encontramos este alumno.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Puede que no exista o que ya no tengas acceso a su información.
      </p>
      <Link href="/admin/alumnos" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted">
        Volver a alumnos
      </Link>
    </div>
  )
}
