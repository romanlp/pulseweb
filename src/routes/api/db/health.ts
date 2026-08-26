import { count } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "#/db/db-client.server.ts";
import { healthChecks } from "#/db/schema";

export const Route = createFileRoute("/api/db/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await getDb()
            .select({ count: count() })
            .from(healthChecks)
            .all();

          return Response.json(
            { ok: true, count: result[0]?.count ?? 0 },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to query D1.";

          return Response.json(
            { ok: false, error: message },
            {
              status: 500,
              headers: { "Cache-Control": "no-store" },
            },
          );
        }
      },
    },
  },
});
