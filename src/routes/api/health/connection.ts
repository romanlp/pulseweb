import { createFileRoute } from "@tanstack/react-router";

import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
} from "@/lib/google-connection/index.server";
import { GOOGLE_HEALTH_SCOPES } from "@/lib/google-health-config";
import { healthApiErrorStatus } from "@/lib/health-endpoint.server";

export const Route = createFileRoute("/api/health/connection")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await getGoogleConnectionStatus(request, {
          requiredScopes: GOOGLE_HEALTH_SCOPES,
        });

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
        const result = await disconnectGoogleConnection(request);

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
