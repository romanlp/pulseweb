import { createFileRoute } from "@tanstack/react-router";

import { fetchHealthSummary } from "#/lib/google-health.server";
import { handleHealthOperation } from "#/lib/health-endpoint.server";

export const Route = createFileRoute("/api/health/summary")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleHealthOperation(request, (accessToken) =>
          fetchHealthSummary(accessToken),
        ),
    },
  },
});
