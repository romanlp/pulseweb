import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFieldContext } from "#/lib/tanstack-form.context"

function PasswordField({ label = "Password" }: { label?: string }) {
  const field = useFieldContext<string>()
  const [showPassword, setShowPassword] = useState(false)
  const error = field.state.meta.errors.map(getErrorMessage).find(Boolean)
  const errorId = `${field.name}-error`

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <div className="relative">
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="current-password"
          className="pr-12"
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          type={showPassword ? "text" : "password"}
          value={field.state.value}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-1 top-1 inline-flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setShowPassword((visible) => !visible)}
          type="button"
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {error && (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message)
  }
  return undefined
}

export { PasswordField }
