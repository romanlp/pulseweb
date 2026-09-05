import { sql } from "drizzle-orm";
import {
  blob,
  foreignKey,
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
