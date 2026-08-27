"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

type Cycle = { id: string; name: string }

export function EnrollmentCycleSelect({ cycles, value }: { cycles: Cycle[]; value: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function changeCycle(cycleId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("cycle", cycleId)
    params.delete("grade")
    params.delete("group")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <label className="grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">Ciclo</span>
      <select
        value={value}
        onChange={(event) => changeCycle(event.target.value)}
        className="h-10 min-w-52 rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
      >
        {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
      </select>
    </label>
  )
}
