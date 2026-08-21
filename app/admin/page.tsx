export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Administración</h1>
      <p className="mt-2 text-neutral-600">
        Acceso administrativo correcto.
      </p>

      <form action="/auth/signout" method="post" className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  )
}
