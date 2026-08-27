import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Activity, HeartPulse } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/tanstack-form"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { error: callbackError } = Route.useSearch()
  const [error, setError] = useState(callbackError)
  const [isGooglePending, setIsGooglePending] = useState(false)

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
    validators: {
      onChange: z.object({
        email: z.email("Enter a valid email address."),
        password: z
          .string()
          .min(8, "Password must contain at least 8 characters."),
        rememberMe: z.boolean(),
      }),
    },
    onSubmit: async ({ value }) => {
      setError(undefined)

      try {
        const result = await authClient.signIn.email(value)

        if (!result.error) {
          await navigate({
            to: "/",
            search: { connected: undefined, error: undefined },
          })
          return
        }

        setError(
          result.error.message ??
            "Check your email and password, then try again.",
        )
      } catch {
        setError("Sign-in is unavailable right now. Try again in a moment.")
      }
    },
  })

  async function handleGoogleSignIn() {
    setError(undefined)
    setIsGooglePending(true)

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/login?error=Google%20sign-in%20could%20not%20be%20completed.",
    })

    if (result.error) {
      setError(result.error.message ?? "Google sign-in could not be completed.")
      setIsGooglePending(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9f7ff] text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(360px,0.9fr)_minmax(560px,1.1fr)]">
        <BrandPanel />

        <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12 lg:py-16">
          <Card className="w-full max-w-[520px] gap-0 rounded-[28px] border-white/80 bg-white py-0 shadow-[0_16px_48px_rgba(52,35,80,0.10)]">
            <CardHeader className="gap-0 px-6 pb-7 pt-8 sm:px-10 sm:pt-10">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <BrandMark />
                <span className="text-lg font-bold tracking-tight">Pulseweb</span>
              </div>
              <p className="mb-3 text-sm font-semibold text-primary">Welcome back</p>
              <CardTitle className="text-[2rem] font-normal leading-tight tracking-[-0.02em] sm:text-[2.5rem]">
                Sign in to your health dashboard
              </CardTitle>
              <CardDescription className="mt-3 max-w-md text-base leading-6">
                Pick up where you left off with your connected activity and health data.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-8 sm:px-10 sm:pb-10">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    className="h-12 w-full border-border bg-white text-foreground shadow-none hover:bg-muted"
                    disabled={isSubmitting || isGooglePending}
                    onClick={handleGoogleSignIn}
                    size="lg"
                    type="button"
                    variant="outline"
                  >
                    <GoogleMark />
                    {isGooglePending ? "Opening Google…" : "Continue with Google"}
                  </Button>
                )}
              </form.Subscribe>

              <div className="my-7 flex items-center gap-4" aria-hidden="true">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  or use email
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void form.handleSubmit()
                }}
              >
                <form.AppField
                  name="email"
                  children={(field) => (
                    <field.EmailField
                      autoFocus
                      label="Email address"
                      placeholder="you@example.com"
                    />
                  )}
                />
                <form.AppField
                  name="password"
                  children={(field) => <field.PasswordField />}
                />
                <form.AppField name="rememberMe">
                  {(field) => (
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-1 text-sm">
                      <input
                        checked={field.state.value}
                        className="size-5 rounded border-2 border-muted-foreground accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.checked)
                        }
                        type="checkbox"
                      />
                      Keep me signed in on this device
                    </label>
                  )}
                </form.AppField>

                {error && (
                  <div
                    className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm leading-5 text-destructive"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <form.AppForm>
                  <form.SubmitButton
                    label="Sign in"
                    pendingLabel="Signing in…"
                  />
                </form.AppForm>
              </form>

              <p className="mt-7 text-center text-sm text-muted-foreground">
                New to Pulseweb?{" "}
                <Link
                  className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  search={{ error: undefined }}
                  to="/signup"
                >
                  Create an account
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#30224f] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-16">
      <div className="relative z-10 flex items-center gap-3">
        <BrandMark />
        <span className="text-xl font-bold tracking-tight">Pulseweb</span>
      </div>

      <div className="relative z-10 max-w-lg pb-10">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-[#e7dcff]">
          <Activity className="size-4" />
          Your signals, brought together
        </div>
        <h1 className="text-[clamp(2.75rem,4vw,4.75rem)] font-light leading-[1.02] tracking-[-0.045em]">
          Health data that keeps pace with you.
        </h1>
        <p className="mt-6 max-w-md text-lg leading-7 text-[#d4c7eb]">
          One calm place to understand your movement, patterns, and progress.
        </p>
      </div>

      <PulseRoute />
    </aside>
  )
}

function BrandMark() {
  return (
    <span className="inline-flex size-11 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-sm">
      <HeartPulse className="size-6" aria-hidden="true" />
    </span>
  )
}

function PulseRoute() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute bottom-20 right-[-7rem] w-[44rem] text-[#9f83db] opacity-45"
      fill="none"
      viewBox="0 0 720 300"
    >
      <path
        d="M4 185C86 185 112 185 160 185C196 185 204 153 228 153C253 153 260 242 287 242C315 242 323 64 354 64C383 64 391 207 421 207C451 207 458 159 486 159C516 159 523 185 559 185H716"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <circle cx="354" cy="64" fill="#c8b5f4" r="9" />
      <circle cx="559" cy="185" fill="#c8b5f4" r="6" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-[18px]" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.1l-.02.11 2.98 2.31.21.02c1.94-1.79 2.96-4.43 2.96-7.16Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.89 6.64-2.61l-3.17-2.45c-.85.58-1.99.98-3.47.98a6.03 6.03 0 0 1-5.7-4.17l-.1.01-3.1 2.4-.04.1A10.02 10.02 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.3 13.75A6.18 6.18 0 0 1 5.96 12c0-.61.11-1.2.32-1.75v-.12L3.14 7.69l-.1.05A10 10 0 0 0 2 12c0 1.53.36 2.98 1.04 4.26l3.26-2.51Z" fill="#FBBC05" />
      <path d="M12 6.08c1.88 0 3.14.81 3.86 1.48l2.85-2.78A9.61 9.61 0 0 0 12 2a10.02 10.02 0 0 0-8.94 5.74l3.22 2.51A6.05 6.05 0 0 1 12 6.08Z" fill="#EA4335" />
    </svg>
  )
}
