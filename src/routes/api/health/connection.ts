import { createFileRoute } from "@tanstack/react-router";

import { getGoogleHealthConnectionStatus } from "@/lib/google-health-auth.server";
import { disconnectGoogleHealth } from "@/lib/google-health-disconnect.server";
import { healthApiErrorStatus } from "@/lib/health-endpoint.server";

export const Route = createFileRoute("/api/health/connection")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await getGoogleHealthConnectionStatus(request);

        if (!result.ok) {
          return Response.json(result.error, {
            status: healthApiErrorStatus(result.error),
            headers: { "Cache-Control": "no-store" },
          });
        }

        return Response.json(result.status, {
          headers: { "Cache-Control": "no-store" },
        });
      },
      DELETE: async ({ request }) => {
        const result = await disconnectGoogleHealth(request);

        if (!result.ok) {
          return Response.json(result.error, {
            status: healthApiErrorStatus(result.error),
            headers: { "Cache-Control": "no-store" },
          });
        }

        return Response.json(
          { status: "disconnected" },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
