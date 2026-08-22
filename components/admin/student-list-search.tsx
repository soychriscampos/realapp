"use client"

import { Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"

export function StudentListSearch({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const normalized = value.trim()

      if ((params.get("query") ?? "") === normalized) return

      if (normalized) params.set("query", normalized)
      else params.delete("query")

      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [pathname, router, searchParams, value])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar alumno..."
        aria-label="Buscar alumno"
        className="h-11 bg-white pl-10"
      />
    </div>
  )
}
