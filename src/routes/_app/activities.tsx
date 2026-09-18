import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock3,
  Footprints,
  HeartPulse,
  MapPinned,
  MessageCircleMore,
  Pause,
  RefreshCw,
  Repeat2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type RunListItem,
  runListResponseSchema,
} from "@/lib/run-sync/run-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/activities")({
  component: Activities,
});

type LoadMode = "initial" | "refresh" | "more";

const outcomePresentation = {
  completed_as_planned: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800",
  },
  ended_early: {
    label: "Ended early",
    className: "bg-amber-100 text-amber-900",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
  unknown: {
    label: "Outcome unavailable",
    className: "bg-muted text-muted-foreground",
  },
} satisfies Record<RunListItem["outcome"], { label: string; className: string }>;

function Activities() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RunListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (mode: LoadMode, cursor?: string) => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      setError(undefined);

      try {
        const search = new URLSearchParams({ limit: "20" });
        if (cursor) search.set("cursor", cursor);
        const response = await fetch(`/api/runs?${search}`, { cache: "no-store" });

        if (response.status === 401) {
          await navigate({
            to: "/login",
            search: { redirect: "/activities", error: undefined },
          });
          return;
        }
        if (!response.ok) throw new Error("Unable to load your activities.");

        const page = runListResponseSchema.parse(await response.json());
        setItems((current) => {
          if (mode !== "more") return page.items;
          const known = new Set(current.map((item) => item.sourceRunId));
          return [
            ...current,
            ...page.items.filter((item) => !known.has(item.sourceRunId)),
          ];
        });
        setNextCursor(page.nextCursor);
      } catch {
        setError(
          mode === "more"
            ? "Unable to load older activities. Try again."
            : mode === "refresh"
              ? "Unable to refresh your activities. The current list is unchanged."
              : "Unable to load your activities. Try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">PulseRun history</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Activities</h1>
          <p className="mt-3 text-muted-foreground">
            Runs synchronized from PulseRun, ordered by when you ran them.
          </p>
        </div>
        <Button
          disabled={loading || refreshing || loadingMore}
          onClick={() => void load("refresh")}
          size="lg"
          type="button"
          variant="outline"
        >
          <RefreshCw className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {error && (
        <div
          className="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p>{error}</p>
          <Button
            onClick={() => void load(items.length === 0 ? "initial" : "refresh")}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <ActivityListSkeleton />
      ) : items.length === 0 ? error ? null : (
        <Card className="mt-10 border-dashed bg-muted/30 text-center">
          <CardContent className="py-12">
            <Footprints className="mx-auto size-10 text-primary" />
            <p className="mt-4 text-lg font-medium">No synced activities yet</p>
            <p className="mx-auto mt-1 max-w-lg text-muted-foreground">
              Finish a run while signed in to PulseRun, or choose to sync your
              existing run history from the Android app.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section aria-labelledby="activity-list-heading" className="mt-10">
          <h2 className="sr-only" id="activity-list-heading">
            Synced runs
          </h2>
          <ul className="space-y-4">
            {items.map((item) => (
              <ActivityCard item={item} key={item.sourceRunId} />
            ))}
          </ul>

          {nextCursor && (
            <div className="mt-8 flex justify-center">
              <Button
                disabled={loadingMore || refreshing}
                onClick={() => void load("more", nextCursor)}
                size="lg"
                type="button"
                variant="outline"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ActivityCard({ item }: { item: RunListItem }) {
  const outcome = outcomePresentation[item.outcome];
  const started = new Date(item.startedAtEpochMillis);
  const ended = new Date(item.endedAtEpochMillis);
  const received = new Date(item.receivedAtEpochMillis);
  const counts = [
    { icon: MapPinned, label: "GPS", value: item.recordCounts.locations },
    { icon: HeartPulse, label: "Heart rate", value: item.recordCounts.heartRates },
    { icon: MessageCircleMore, label: "Cues", value: item.recordCounts.cues },
    { icon: Pause, label: "Pauses", value: item.recordCounts.pauses },
    { icon: Repeat2, label: "Steps", value: item.recordCounts.executions },
  ];

  return (
    <li>
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl">
              {item.workoutLabel?.trim() || "Run"}
            </CardTitle>
            <CardDescription className="mt-1">
              {started.toLocaleDateString(undefined, {
                dateStyle: "full",
              })}
            </CardDescription>
          </div>
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium",
              outcome.className,
            )}
          >
            {outcome.label}
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-4" />
              {started.toLocaleTimeString(undefined, { timeStyle: "short" })}–
              {ended.toLocaleTimeString(undefined, { timeStyle: "short" })}
            </span>
            <span>Received {received.toLocaleString()}</span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {counts.map(({ icon: Icon, label, value }) => (
              <div className="rounded-xl bg-muted/50 p-3" key={label}>
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </dt>
                <dd className="mt-1 text-lg font-semibold">
                  {value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      </li>
  );
}

function ActivityListSkeleton() {
  return (
    <div aria-label="Loading activities" className="mt-10 space-y-4" role="status">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
      <span className="sr-only">Loading activities…</span>
    </div>
  );
}
