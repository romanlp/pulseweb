import { and, desc, eq, lt, or } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/db/db-client.server";
import { runActivity, runActivityProjection } from "@/db/run-schema";
import { auth } from "@/lib/auth";
import type { RunListItem } from "@/lib/run-sync/run-list";
import {
  encodeRunCursor,
  parseRunListQuery,
} from "@/lib/run-sync/run-pagination";

const noStore = { "Cache-Control": "no-store" };

function errorResponse(code: string, status: number) {
  return Response.json({ code, retryable: false }, { status, headers: noStore });
}

async function listRuns(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return errorResponse("unauthenticated", 401);

  const query = parseRunListQuery(new URL(request.url).searchParams);
  if (!query) return errorResponse("invalid_query", 400);

  const cursorCondition = query.cursor
    ? or(
        lt(
          runActivityProjection.startedAtEpochMillis,
          query.cursor.startedAtEpochMillis,
        ),
        and(
          eq(
            runActivityProjection.startedAtEpochMillis,
            query.cursor.startedAtEpochMillis,
          ),
          lt(runActivityProjection.sourceRunId, query.cursor.sourceRunId),
        ),
      )
    : undefined;

  const rows = await getDb()
    .select({
      sourceRunId: runActivityProjection.sourceRunId,
      schemaVersion: runActivity.schemaVersion,
      startedAtEpochMillis: runActivityProjection.startedAtEpochMillis,
      endedAtEpochMillis: runActivityProjection.endedAtEpochMillis,
      status: runActivityProjection.status,
      outcome: runActivityProjection.outcome,
      workoutLabel: runActivityProjection.workoutLabel,
      receivedAt: runActivity.receivedAt,
      locationCount: runActivityProjection.locationCount,
      heartRateCount: runActivityProjection.heartRateCount,
      cueCount: runActivityProjection.cueCount,
      pauseCount: runActivityProjection.pauseCount,
      executionCount: runActivityProjection.executionCount,
    })
    .from(runActivityProjection)
    .innerJoin(
      runActivity,
      and(
        eq(runActivity.userId, runActivityProjection.userId),
        eq(runActivity.sourceRunId, runActivityProjection.sourceRunId),
      ),
    )
    .where(
      and(
        eq(runActivityProjection.userId, session.user.id),
        cursorCondition,
      ),
    )
    .orderBy(
      desc(runActivityProjection.startedAtEpochMillis),
      desc(runActivityProjection.sourceRunId),
    )
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const items: RunListItem[] = page.map((row) => {
    if (row.schemaVersion !== 1) {
      throw new Error("Unsupported stored run schema version");
    }
    return {
      sourceRunId: row.sourceRunId,
      schemaVersion: row.schemaVersion,
      startedAtEpochMillis: row.startedAtEpochMillis,
      endedAtEpochMillis: row.endedAtEpochMillis,
      status: row.status,
      outcome: row.outcome,
      workoutLabel: row.workoutLabel,
      receivedAtEpochMillis: row.receivedAt.getTime(),
      recordCounts: {
        locations: row.locationCount,
        heartRates: row.heartRateCount,
        cues: row.cueCount,
        pauses: row.pauseCount,
        executions: row.executionCount,
      },
    };
  });
  const last = hasMore ? items.at(-1) : undefined;

  return Response.json(
    {
      items,
      nextCursor: last
        ? encodeRunCursor({
            startedAtEpochMillis: last.startedAtEpochMillis,
            sourceRunId: last.sourceRunId,
          })
        : null,
    },
    { headers: noStore },
  );
}

export const Route = createFileRoute("/api/runs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await listRuns(request);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown runs list failure";
          console.error("Run list failed:", message);
          return errorResponse("temporarily_unavailable", 503);
        }
      },
    },
  },
});
