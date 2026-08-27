import { createFileRoute } from "@tanstack/react-router";

import { getGoogleHealthConnectionStatus } from "@/lib/google-health-auth.server";

export const Route = createFileRoute("/api/health/connection")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await getGoogleHealthConnectionStatus(request);

        if (!result.ok) {
          return Response.json(result.error, {
            status: 401,
            headers: { "Cache-Control": "no-store" },
          });
        }

        return Response.json(result.status, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
