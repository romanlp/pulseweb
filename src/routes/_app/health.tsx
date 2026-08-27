import { createFileRoute } from "@tanstack/react-router";
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
import { useState, type ReactNode } from "react";

import { Button, buttonVariants } from "#/components/ui/button";
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

export const Route = createFileRoute("/_app/health")({
  validateSearch: (search: Record<string, unknown>) => ({
    connected: search.connected === "1" ? true : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: Health,
});

function Health() {
  const { connected, error: oauthError } = Route.useSearch();
  const [summary, setSummary] = useState<HealthSummaryResponse>();
  const [error, setError] = useState(oauthError);
  const [loading, setLoading] = useState(false);

  async function loadSummary() {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/health/summary");
      const body = (await response.json()) as HealthSummaryResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to fetch your health summary.");
      }

      setSummary(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

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

        <div className="flex flex-wrap gap-3">
          <a
            className={buttonVariants({ variant: "outline", size: "lg" })}
            href="/api/auth/google"
          >
            {connected ? "Reconnect Google" : "Connect Google Health"}
          </a>
          <Button disabled={loading} onClick={loadSummary} size="lg" type="button">
            <RefreshCw className={loading ? "animate-spin" : undefined} />
            {loading ? "Fetching…" : "Fetch summary"}
          </Button>
        </div>
      </header>

      {connected && !error && (
        <p className="mt-6 text-sm text-emerald-700">
          Google Health is connected for this browser session.
        </p>
      )}

      {error && (
        <p
          className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {!summary && !loading && (
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
