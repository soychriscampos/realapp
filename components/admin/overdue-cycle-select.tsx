"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

type Cycle = { id: string; name: string }

export function OverdueCycleSelect({ cycles, value }: { cycles: Cycle[]; value: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function changeCycle(cycleId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (cycleId) params.set("cycle", cycleId)
    else params.delete("cycle")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <label className="grid w-full gap-1 text-sm font-medium sm:w-auto">
      <span className="text-xs text-muted-foreground">Vista</span>
      <select
        value={value}
        onChange={(event) => changeCycle(event.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 sm:min-w-52"
      >
        <option value="">Todo</option>
        {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>Por ciclo: {cycle.name}</option>)}
      </select>
    </label>
  )
}
