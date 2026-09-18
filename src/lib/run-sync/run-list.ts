import { z } from "zod";

import listContractJsonSchema from "./list-v1.schema.json" with { type: "json" };

const countSchema = z.number().int().nonnegative();

const runListItemContract = z.object({
  sourceRunId: z.uuid(),
  schemaVersion: z.literal(1),
  startedAtEpochMillis: z.number().int().nonnegative(),
  endedAtEpochMillis: z.number().int().nonnegative(),
  status: z.enum(["completed", "failed"]),
  outcome: z.enum([
    "completed_as_planned",
    "ended_early",
    "failed",
    "unknown",
  ]),
  workoutLabel: z.string().nullable(),
  receivedAtEpochMillis: z.number().int().nonnegative(),
  recordCounts: z.object({
    locations: countSchema,
    heartRates: countSchema,
    cues: countSchema,
    pauses: countSchema,
    executions: countSchema,
  }),
});

type RunListContract = {
  items: Array<z.infer<typeof runListItemContract>>;
  nextCursor: string | null;
};

type JsonSchemaInput = Parameters<typeof z.fromJSONSchema>[0];

const listContractInput: JsonSchemaInput = JSON.parse(
  JSON.stringify(listContractJsonSchema),
);
// SAFETY: A byte-for-byte contract-copy test guards this runtime schema.
export const runListResponseSchema = z.fromJSONSchema(
  listContractInput,
) as z.ZodType<RunListContract>;

export type RunListItem = z.infer<typeof runListItemContract>;
export type RunListResponse = z.infer<typeof runListResponseSchema>;
