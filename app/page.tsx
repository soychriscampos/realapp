import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7f8] text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-16">
        <header className="flex items-center">
          <img
            src="https://totjxquczdongmourczc.supabase.co/storage/v1/object/public/img/logo-real.png"
            alt="Colegio REAL de Escuinapa"
            className="h-10 w-auto object-contain"
          />
        </header>

        <section className="flex flex-1 items-center">
          <div className="max-w-xl">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Colegio REAL de Escuinapa
            </p>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Plataforma institucional
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-neutral-500 sm:text-lg">
              Acceso privado para personal y familias del Colegio REAL.
            </p>

            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-60"
              >
                Acceder a la plataforma
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-neutral-200 pt-5 text-xs text-neutral-400">
          <span>© {new Date().getFullYear()} · Colegio REAL de Escuinapa</span>
          <span>colegioreal.app</span>
        </footer>
      </div>
    </main>
  )
}
