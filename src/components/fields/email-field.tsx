import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { firstFieldErrorMessage } from "@/components/fields/field-error"
import { useFieldContext } from "#/lib/tanstack-form.context"

type EmailFieldProps = {
  autoFocus?: boolean
  label: string
  placeholder?: string
}

function EmailField({ autoFocus, label, placeholder }: EmailFieldProps) {
  const field = useFieldContext<string>()
  const error = firstFieldErrorMessage(field.state.meta.errors)
  const errorId = `${field.name}-error`

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="email"
        autoFocus={autoFocus}
        id={field.name}
        inputMode="email"
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        type="email"
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

export { EmailField }
