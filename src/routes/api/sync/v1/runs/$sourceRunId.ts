import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/db/db-client.server";
import { runActivity } from "@/db/run-schema";
import { auth } from "@/lib/auth";
import { buildRunActivityProjection } from "@/lib/run-sync/run-activity-projection";
import {
  type RunV1,
  type RunUploadCandidate,
  validateRunV1,
} from "@/lib/run-sync/run-v1";

const maxPayloadBytes = 8 * 1024 * 1024;
const chunkBytes = 256 * 1024;
const sourceRunIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const noStore = { "Cache-Control": "no-store" };

function errorResponse(code: string, status: number, retryable = false) {
  return Response.json({ code, retryable }, { status, headers: noStore });
}

async function readBoundedBody(request: Request) {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxPayloadBytes) {
    return null;
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxPayloadBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function findReceipt(
  db: ReturnType<typeof getDb>,
  userId: string,
  sourceRunId: string,
) {
  const [receipt] = await db
    .select({
      sourceRunId: runActivity.sourceRunId,
      schemaVersion: runActivity.schemaVersion,
      contentSha256: runActivity.contentSha256,
      receivedAt: runActivity.receivedAt,
    })
    .from(runActivity)
    .where(
      and(
        eq(runActivity.userId, userId),
        eq(runActivity.sourceRunId, sourceRunId),
      ),
    )
    .limit(1);

  return receipt;
}

function receiptResponse(
  receipt: NonNullable<Awaited<ReturnType<typeof findReceipt>>>,
  status: number,
) {
  return Response.json(
    {
      sourceRunId: receipt.sourceRunId,
      schemaVersion: receipt.schemaVersion,
      contentSha256: receipt.contentSha256,
      receivedAtEpochMillis: receipt.receivedAt.getTime(),
    },
    { status, headers: noStore },
  );
}

function projectionStatement(
  db: ReturnType<typeof getDb>,
  userId: string,
  run: RunV1,
) {
  const projection = buildRunActivityProjection(run);
  return db.$client
    .prepare(
      "INSERT OR IGNORE INTO run_activity_projection (user_id, source_run_id, started_at_epoch_millis, ended_at_epoch_millis, status, outcome, workout_label, location_count, heart_rate_count, cue_count, pause_count, execution_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      userId,
      projection.sourceRunId,
      projection.startedAtEpochMillis,
      projection.endedAtEpochMillis,
      projection.status,
      projection.outcome,
      projection.workoutLabel,
      projection.locationCount,
      projection.heartRateCount,
      projection.cueCount,
      projection.pauseCount,
      projection.executionCount,
    );
}

async function ensureProjection(
  db: ReturnType<typeof getDb>,
  userId: string,
  run: RunV1,
) {
  await db.$client.batch([projectionStatement(db, userId, run)]);
}

async function uploadRun(request: Request, sourceRunId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return errorResponse("unauthenticated", 401);
  if (!sourceRunIdPattern.test(sourceRunId)) {
    return errorResponse("id_mismatch", 400);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return errorResponse("invalid_json", 400);
  }

  const expectedHash = request.headers.get("X-PulseRun-Content-SHA256");
  if (!expectedHash || !sha256Pattern.test(expectedHash)) {
    return errorResponse("invalid_hash", 400);
  }

  const bytes = await readBoundedBody(request);
  if (!bytes) return errorResponse("payload_too_large", 413);
  if ((await sha256(bytes)) !== expectedHash) {
    return errorResponse("invalid_hash", 400);
  }

  let value: RunUploadCandidate;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return errorResponse("invalid_json", 400);
  }

  const validation = validateRunV1(value);
  if (!validation.ok) return errorResponse(validation.code, 422);
  if (validation.run.sourceRunId !== sourceRunId) {
    return errorResponse("id_mismatch", 400);
  }

  const db = getDb();
  const existing = await findReceipt(db, session.user.id, sourceRunId);
  if (existing) {
    if (existing.contentSha256 !== expectedHash) {
      return errorResponse("payload_conflict", 409);
    }
    await ensureProjection(db, session.user.id, validation.run);
    return receiptResponse(existing, 200);
  }

  const receivedAtEpochMillis = Date.now();
  const chunkCount = Math.ceil(bytes.byteLength / chunkBytes);
  const statements: D1PreparedStatement[] = [
    db.$client
      .prepare(
        "INSERT INTO run_activity (user_id, source_run_id, schema_version, content_sha256, payload_byte_count, chunk_count, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        session.user.id,
        sourceRunId,
        validation.run.schemaVersion,
        expectedHash,
        bytes.byteLength,
        chunkCount,
        receivedAtEpochMillis,
      ),
  ];

  for (let start = 0; start < bytes.byteLength; start += chunkBytes) {
    const chunk = bytes.slice(start, start + chunkBytes);
    statements.push(
      db.$client
        .prepare(
          "INSERT INTO run_activity_payload_chunk (user_id, source_run_id, ordinal, payload) VALUES (?, ?, ?, ?)",
        )
        .bind(session.user.id, sourceRunId, start / chunkBytes, chunk.buffer),
    );
  }
  statements.push(projectionStatement(db, session.user.id, validation.run));

  try {
    await db.$client.batch(statements);
  } catch (error) {
    const raced = await findReceipt(db, session.user.id, sourceRunId);
    if (!raced) throw error;
    if (raced.contentSha256 !== expectedHash) {
      return errorResponse("payload_conflict", 409);
    }
    await ensureProjection(db, session.user.id, validation.run);
    return receiptResponse(raced, 200);
  }

  return Response.json(
    {
      sourceRunId,
      schemaVersion: validation.run.schemaVersion,
      contentSha256: expectedHash,
      receivedAtEpochMillis,
    },
    { status: 201, headers: noStore },
  );
}

export const Route = createFileRoute("/api/sync/v1/runs/$sourceRunId")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          return await uploadRun(request, params.sourceRunId);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown upload failure";
          console.error("Run upload failed:", message);
          return errorResponse("temporarily_unavailable", 503, true);
        }
      },
    },
  },
});
