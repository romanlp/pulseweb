import { createFileRoute } from "@tanstack/react-router";

import {
  cookie,
  createGoogleAuthorizationUrl,
  createRandomState,
} from "#/lib/google-oauth.server";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const state = createRandomState();
        const secure = new URL(request.url).protocol === "https:";

        return new Response(null, {
          status: 302,
          headers: {
            Location: createGoogleAuthorizationUrl(state),
            "Set-Cookie": cookie("google_oauth_state", state, {
              maxAge: 10 * 60,
              secure,
            }),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
