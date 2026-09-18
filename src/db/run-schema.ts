import { sql } from "drizzle-orm";
import {
  blob,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth-schema";

export const runActivity = sqliteTable(
  "run_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceRunId: text("source_run_id").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    contentSha256: text("content_sha256").notNull(),
    payloadByteCount: integer("payload_byte_count").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sourceRunId] })],
);

export const runActivityPayloadChunk = sqliteTable(
  "run_activity_payload_chunk",
  {
    userId: text("user_id").notNull(),
    sourceRunId: text("source_run_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    payload: blob("payload", { mode: "buffer" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sourceRunId, table.ordinal] }),
    foreignKey({
      columns: [table.userId, table.sourceRunId],
      foreignColumns: [runActivity.userId, runActivity.sourceRunId],
    }).onDelete("cascade"),
  ],
);

export const runActivityProjection = sqliteTable(
  "run_activity_projection",
  {
    userId: text("user_id").notNull(),
    sourceRunId: text("source_run_id").notNull(),
    startedAtEpochMillis: integer("started_at_epoch_millis").notNull(),
    endedAtEpochMillis: integer("ended_at_epoch_millis").notNull(),
    status: text("status", { enum: ["completed", "failed"] }).notNull(),
    outcome: text("outcome", {
      enum: ["completed_as_planned", "ended_early", "failed", "unknown"],
    }).notNull(),
    workoutLabel: text("workout_label"),
    locationCount: integer("location_count").notNull(),
    heartRateCount: integer("heart_rate_count").notNull(),
    cueCount: integer("cue_count").notNull(),
    pauseCount: integer("pause_count").notNull(),
    executionCount: integer("execution_count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sourceRunId] }),
    foreignKey({
      columns: [table.userId, table.sourceRunId],
      foreignColumns: [runActivity.userId, runActivity.sourceRunId],
    }).onDelete("cascade"),
    index("run_activity_projection_owner_started_idx").on(
      table.userId,
      table.startedAtEpochMillis,
      table.sourceRunId,
    ),
  ],
);
