import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/db/db-client.server";
import { runActivity } from "@/db/run-schema";
import { auth } from "@/lib/auth";

const sourceRunIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const noStore = { "Cache-Control": "no-store" };

export const Route = createFileRoute(
  "/api/sync/v1/runs/$sourceRunId/receipt",
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return Response.json(
            { code: "unauthenticated", retryable: false },
            { status: 401, headers: noStore },
          );
        }

        const sourceRunId = params.sourceRunId;
        if (!sourceRunIdPattern.test(sourceRunId)) {
          return Response.json(
            { code: "not_found", retryable: false },
            { status: 404, headers: noStore },
          );
        }

        const [receipt] = await getDb()
          .select({
            sourceRunId: runActivity.sourceRunId,
            schemaVersion: runActivity.schemaVersion,
            contentSha256: runActivity.contentSha256,
            receivedAt: runActivity.receivedAt,
          })
          .from(runActivity)
          .where(
            and(
              eq(runActivity.userId, session.user.id),
              eq(runActivity.sourceRunId, sourceRunId),
            ),
          )
          .limit(1);

        if (!receipt) {
          return Response.json(
            { code: "not_found", retryable: false },
            { status: 404, headers: noStore },
          );
        }

        return Response.json(
          {
            sourceRunId: receipt.sourceRunId,
            schemaVersion: receipt.schemaVersion,
            contentSha256: receipt.contentSha256,
            receivedAtEpochMillis: receipt.receivedAt.getTime(),
          },
          { headers: noStore },
        );
      },
    },
  },
});
