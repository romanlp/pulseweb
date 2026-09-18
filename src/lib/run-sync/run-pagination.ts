export type RunCursor = {
  startedAtEpochMillis: number;
  sourceRunId: string;
};

export type RunListQuery = {
  limit: number;
  cursor: RunCursor | null;
};

const sourceRunIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const runCursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    startedAtEpochMillis: z.number().int().nonnegative().safe(),
    sourceRunId: z.string().regex(sourceRunIdPattern),
  })
  .strict();

function toBase64Url(value: string) {
  return btoa(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid base64url");
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (standard.length % 4)) % 4);
  return atob(standard + padding);
}

export function encodeRunCursor(cursor: RunCursor) {
  return toBase64Url(
    JSON.stringify({
      version: 1,
      startedAtEpochMillis: cursor.startedAtEpochMillis,
      sourceRunId: cursor.sourceRunId,
    }),
  );
}

export function decodeRunCursor(value: string): RunCursor | null {
  try {
    const parsed = runCursorEnvelopeSchema.safeParse(
      JSON.parse(fromBase64Url(value)),
    );
    if (!parsed.success) return null;
    return {
      startedAtEpochMillis: parsed.data.startedAtEpochMillis,
      sourceRunId: parsed.data.sourceRunId,
    };
  } catch {
    return null;
  }
}

export function parseRunListQuery(search: URLSearchParams): RunListQuery | null {
  if ([...search.keys()].some((key) => key !== "limit" && key !== "cursor")) {
    return null;
  }
  if (search.getAll("limit").length > 1 || search.getAll("cursor").length > 1) {
    return null;
  }

  const limitValue = search.get("limit");
  const limit = limitValue === null ? 20 : Number(limitValue);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (limitValue !== null && String(limit) !== limitValue)
  ) {
    return null;
  }

  const cursorValue = search.get("cursor");
  const cursor = cursorValue === null ? null : decodeRunCursor(cursorValue);
  return cursorValue !== null && cursor === null ? null : { limit, cursor };
}
import { z } from "zod";
