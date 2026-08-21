"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function PasswordField() {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={isVisible ? "text" : "password"}
        autoComplete="current-password"
        required
        className="h-12 pr-12"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1.5 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setIsVisible((visible) => !visible)}
      >
        {isVisible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}
