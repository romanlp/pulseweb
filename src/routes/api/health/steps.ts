import { createFileRoute } from "@tanstack/react-router";

import {
  GoogleHealthError,
  fetchRecentSteps,
} from "#/lib/google-health.server";
import { cookie, readCookie } from "#/lib/google-oauth.server";

export const Route = createFileRoute("/api/health/steps")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const accessToken = readCookie(request, "google_health_access_token");

        if (!accessToken) {
          return Response.json(
            { error: "Connect Google Health first." },
            { status: 401 },
          );
        }

        try {
          const steps = await fetchRecentSteps(accessToken);
          return Response.json(steps, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          const status =
            error instanceof GoogleHealthError ? error.status : 500;
          const message =
            error instanceof Error ? error.message : "Unable to fetch steps.";
          const headers = new Headers({ "Cache-Control": "no-store" });

          if (status === 401) {
            headers.append(
              "Set-Cookie",
              cookie("google_health_access_token", "", {
                maxAge: 0,
                secure: new URL(request.url).protocol === "https:",
              }),
            );
          }

          return Response.json({ error: message }, { status, headers });
        }
      },
    },
  },
});
