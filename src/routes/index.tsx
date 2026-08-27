import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type StepsResponse = {
  total: number;
  sampleCount: number;
  from: string;
  to: string;
  recent: Array<{
    count: number;
    startTime: string;
    endTime: string;
  }>;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    connected: search.connected === "1" ? true : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: Home,
});

function Home() {
  const { connected, error: oauthError } = Route.useSearch();
  const [steps, setSteps] = useState<StepsResponse>();
  const [error, setError] = useState(oauthError);
  const [loading, setLoading] = useState(false);

  async function loadSteps() {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/health/steps");
      const body = (await response.json()) as StepsResponse & { error?: string };

      if (!response.ok) throw new Error(body.error ?? "Unable to fetch steps.");
      setSteps(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
      <div className="rounded-3xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-primary">Google Health API POC</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Read your recent steps
        </h1>
        <p className="mt-4 text-muted-foreground">
          Connect your Google account, then fetch reconciled step records from
          the last seven days. This demo requests read-only activity access.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
            href="/api/auth/google"
          >
            {connected ? "Reconnect Google" : "Connect Google Health"}
          </a>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium disabled:opacity-50"
            disabled={loading}
            onClick={loadSteps}
            type="button"
          >
            {loading ? "Fetching…" : "Fetch steps"}
          </button>
        </div>

        {connected && !error && (
          <p className="mt-5 text-sm text-emerald-700">
            Google Health is connected for this browser session.
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {steps && (
          <section className="mt-8 border-t pt-6">
            <p className="text-sm text-muted-foreground">Last seven days</p>
            <p className="mt-1 text-5xl font-bold tabular-nums">
              {steps.total.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              steps across {steps.sampleCount.toLocaleString()} reconciled
              records
            </p>

            <details className="mt-6 text-sm">
              <summary className="cursor-pointer font-medium">
                Show recent records
              </summary>
              <ul className="mt-3 space-y-2">
                {steps.recent.map((sample) => (
                  <li
                    className="flex justify-between gap-4 rounded-lg bg-muted p-3"
                    key={`${sample.startTime}-${sample.endTime}`}
                  >
                    <span>{new Date(sample.startTime).toLocaleString()}</span>
                    <strong>{sample.count.toLocaleString()} steps</strong>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}
