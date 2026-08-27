import { ArrowRight } from "lucide-react"

import { Button } from "#/components/ui/button"
import { useFormContext } from "#/lib/tanstack-form.context"

function SubmitButton({
  label,
  pendingLabel = "Submitting…",
}: {
  label: string
  pendingLabel?: string
}) {
  const form = useFormContext()

  console.log(form.getAllErrors());

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button
          aria-busy={isSubmitting}
          className="h-12 w-full text-base"
          disabled={!canSubmit || isSubmitting}
          size="lg"
          type="submit"
        >
          {isSubmitting ? pendingLabel : label}
          {!isSubmitting && <ArrowRight data-icon="inline-end" />}
        </Button>
      )}
    </form.Subscribe>
  )
}

export { SubmitButton }
