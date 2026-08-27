import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFieldContext } from "#/lib/tanstack-form.context"


function TextField({ label }: { label: string }) {
  const field = useFieldContext<string>()
  const error = field.state.meta.errors.map(getErrorMessage).find(Boolean)
  const errorId = `${field.name}-error`

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="name"
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        type="text"
        value={field.state.value}
      />
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

export {TextField}
