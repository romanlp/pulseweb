import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  MapPinned,
  RefreshCw,
  Timer,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";

type HealthSummaryResponse = {
  from: string;
  to: string;
  steps: {
    total: number;
    sampleCount: number;
    recent: Array<{
      count: number;
      startTime: string;
      endTime: string;
    }>;
  };
  distanceKm: number | null;
  activeZoneMinutes: number | null;
  caloriesKcal: number | null;
  vo2Max: {
    value: number;
    level: string | null;
    date: string;
  } | null;
  workouts: Array<{
    type: string;
    name: string;
    startTime: string;
    endTime: string;
    activeMinutes: number | null;
    distanceKm: number | null;
    caloriesKcal: number | null;
    averageHeartRate: number | null;
    activeZoneMinutes: number | null;
    runVo2Max: number | null;
  }>;
};

type ConnectionState =
  | { status: "loading" }
  | { status: "connected" }
  | { status: "not_connected" }
  | { status: "reconnect_required" }
  | { status: "unavailable" };

export const Route = createFileRoute("/_app/health")({
  validateSearch: (search: Record<string, unknown>) => ({
    connected: search.connected === "1" ? true : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: Health,
});

function Health() {
  const { connected } = Route.useSearch();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<ConnectionState>({
    status: "loading",
  });
  const [reconnectDismissed, setReconnectDismissed] = useState(false);
  const [linking, setLinking] = useState(false);
  const [summary, setSummary] = useState<HealthSummaryResponse>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string>();

  async function loadConnection() {
    try {
      const response = await fetch("/api/health/connection", {
        cache: "no-store",
      });

      if (!response.ok) {
        setConnection({ status: "unavailable" });
        return;
      }

      const body = (await response.json()) as {
        status: "connected" | "not_connected" | "reconnect_required";
      };

      setConnection(
        body.status === "connected" || body.status === "not_connected"
          ? { status: body.status }
          : { status: "reconnect_required" },
      );
    } catch {
      setConnection({ status: "unavailable" });
    }
  }

  useEffect(() => {
    void loadConnection();
  }, []);

  useEffect(() => {
    if (connected) {
      setReconnectDismissed(false);
      void navigate({
        to: "/health",
        search: { connected: undefined, error: undefined },
        replace: true,
      });
    }
  }, [connected, navigate]);

  async function linkGoogle() {
    setLinking(true);
    setSummaryError(undefined);

    try {
      const result = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/health?connected=1",
        scopes: [
          "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
        ],
        additionalParams: {
          access_type: "offline",
          prompt: "consent",
        },
      });

      if (result.error || !result.data?.redirect) {
        throw new Error(
          result.error?.message ?? "Unable to start Google Health linking.",
        );
      }

      window.location.href = result.data.url;
    } catch (caught) {
      setLinking(false);
      setSummaryError(
        caught instanceof Error
          ? caught.message
          : "Unable to start Google Health linking.",
      );
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    setSummaryError(undefined);

    try {
      const response = await fetch("/api/health/summary");
      const body = (await response.json()) as HealthSummaryResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? "Unable to fetch your health summary.");
      }

      setSummary(body);
    } catch (caught) {
      setSummaryError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  const isConnected = connection.status === "connected";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Google Health API POC</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Your week in motion
          </h1>
          <p className="mt-3 text-muted-foreground">
            A seven-day activity snapshot using the same read-only permission as
            the original steps demo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isConnected ? (
            <>
              <span className="inline-flex items-center gap-2 self-center text-sm text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-emerald-600"
                />
                Google Health connected
              </span>
              <Button
                disabled={summaryLoading || linking}
                onClick={loadSummary}
                size="lg"
                type="button"
              >
                <RefreshCw className={summaryLoading ? "animate-spin" : undefined} />
                {summaryLoading ? "Fetching…" : "Fetch summary"}
              </Button>
            </>
          ) : (
            connection.status === "not_connected" && (
              <Button
                disabled={linking}
                onClick={linkGoogle}
                size="lg"
                type="button"
              >
                {linking ? "Preparing…" : "Connect Google Health"}
              </Button>
            )
          )}
        </div>
      </header>

      {connection.status === "loading" && (
        <p className="mt-6 text-sm text-muted-foreground">
          Checking your Google Health connection…
        </p>
      )}

      {connection.status === "not_connected" && (
        <p className="mt-6 text-sm text-muted-foreground">
          Connect Google Health to see your activity.
        </p>
      )}

      {connection.status === "reconnect_required" && !reconnectDismissed && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-medium text-amber-900">
            Your Google Health connection has expired. Reconnect to continue
            syncing your activity.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={linking}
              onClick={linkGoogle}
              size="sm"
              type="button"
            >
              {linking ? "Preparing…" : "Reconnect Google Health"}
            </Button>
            <Button
              onClick={() => setReconnectDismissed(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Not now
            </Button>
          </div>
        </div>
      )}

      {connection.status === "unavailable" && (
        <div className="mt-6 rounded-2xl bg-muted/50 p-5">
          <p className="text-muted-foreground">
            Google Health is temporarily unavailable. Try again shortly.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setConnection({ status: "loading" });
              void loadConnection();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      )}

      {summaryError && (
        <p
          className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {summaryError}
        </p>
      )}

      {!summary && !summaryLoading && isConnected && (
        <Card className="mt-10 border-dashed bg-muted/30 text-center">
          <CardContent className="py-10">
            <Activity className="mx-auto size-10 text-primary" />
            <p className="mt-4 text-lg font-medium">Ready when you are</p>
            <p className="mt-1 text-muted-foreground">
              Connect Google Health, then fetch your latest activity summary.
            </p>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="mt-10 space-y-8">
          <section aria-labelledby="weekly-summary-heading">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold" id="weekly-summary-heading">
                Last seven days
              </h2>
              <p className="text-sm text-muted-foreground">
                Updated {new Date(summary.to).toLocaleString()}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={<Footprints />}
                label="Steps"
                value={summary.steps.total.toLocaleString()}
              />
              <MetricCard
                icon={<MapPinned />}
                label="Distance"
                value={formatMetric(summary.distanceKm, "km", 1)}
              />
              <MetricCard
                icon={<HeartPulse />}
                label="Zone minutes"
                value={formatMetric(summary.activeZoneMinutes, "min")}
              />
              <MetricCard
                icon={<Flame />}
                label="Total energy"
                value={formatMetric(summary.caloriesKcal, "kcal")}
              />
              <MetricCard
                description={formatFitnessLevel(summary.vo2Max?.level)}
                icon={<Gauge />}
                label="VO₂ max"
                value={formatMetric(summary.vo2Max?.value ?? null, "ml/kg/min", 1)}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recent workouts</CardTitle>
              <CardDescription>
                Up to five exercise sessions recorded during this period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary.workouts.length === 0 ? (
                <p className="rounded-xl bg-muted/50 p-6 text-center text-muted-foreground">
                  No workouts were returned for this week.
                </p>
              ) : (
                <ul className="divide-y">
                  {summary.workouts.map((workout) => (
                    <li
                      className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      key={`${workout.startTime}-${workout.type}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="rounded-full bg-primary/10 p-2 text-primary">
                          <Activity className="size-5" />
                        </span>
                        <div>
                          <p className="font-medium">{workout.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {new Date(workout.startTime).toLocaleString()} ·{" "}
                            {formatWorkoutType(workout.type)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm sm:justify-end">
                        <WorkoutStat
                          icon={<Timer />}
                          value={formatMetric(workout.activeMinutes, "min")}
                        />
                        <WorkoutStat
                          icon={<MapPinned />}
                          value={formatMetric(workout.distanceKm, "km", 1)}
                        />
                        <WorkoutStat
                          icon={<HeartPulse />}
                          value={formatMetric(workout.averageHeartRate, "bpm")}
                        />
                        <WorkoutStat
                          icon={<Flame />}
                          value={formatMetric(workout.caloriesKcal, "kcal")}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <details className="rounded-2xl bg-muted/40 p-5 text-sm">
            <summary className="cursor-pointer font-medium">
              Show recent step records
            </summary>
            <p className="mt-2 text-muted-foreground">
              {summary.steps.sampleCount.toLocaleString()} reconciled records in
              this summary.
            </p>
            <ul className="mt-4 space-y-2">
              {summary.steps.recent.map((sample) => (
                <li
                  className="flex justify-between gap-4 rounded-xl bg-background p-3"
                  key={`${sample.startTime}-${sample.endTime}`}
                >
                  <span>{new Date(sample.startTime).toLocaleString()}</span>
                  <strong>{sample.count.toLocaleString()} steps</strong>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </main>
  );
}

function MetricCard({
  description,
  icon,
  label,
  value,
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center gap-2 text-primary [&_svg]:size-5">
          {icon}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function WorkoutStat({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground [&_svg]:size-4">
      {icon}
      {value}
    </span>
  );
}

function formatMetric(value: number | null, unit: string, digits = 0) {
  if (value === null) return "No data";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits })} ${unit}`;
}

function formatWorkoutType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatFitnessLevel(level?: string | null) {
  return level ? formatWorkoutType(level) : undefined;
}
