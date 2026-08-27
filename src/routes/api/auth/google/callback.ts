import { createFileRoute } from "@tanstack/react-router";

import {
  cookie,
  exchangeCodeForAccessToken,
  readCookie,
} from "#/lib/google-oauth.server";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secure = url.protocol === "https:";
        const state = url.searchParams.get("state");
        const expectedState = readCookie(request, "google_oauth_state");
        const code = url.searchParams.get("code");
        const oauthError = url.searchParams.get("error");

        if (oauthError) {
          return redirectHome(url, `Google authorization failed: ${oauthError}`);
        }

        if (!state || !expectedState || state !== expectedState || !code) {
          return redirectHome(url, "Invalid or expired Google authorization.");
        }

        try {
          const token = await exchangeCodeForAccessToken(code);
          const headers = new Headers({
            Location: "/?connected=1",
            "Cache-Control": "no-store",
          });

          headers.append(
            "Set-Cookie",
            cookie("google_health_access_token", token.accessToken, {
              maxAge: token.expiresIn,
              secure,
            }),
          );
          headers.append(
            "Set-Cookie",
            cookie("google_oauth_state", "", { maxAge: 0, secure }),
          );

          return new Response(null, { status: 302, headers });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Token exchange failed.";
          return redirectHome(url, message);
        }
      },
    },
  },
});

function redirectHome(url: URL, error: string) {
  const destination = new URL("/", url.origin);
  destination.searchParams.set("error", error);

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.pathname + destination.search,
      "Cache-Control": "no-store",
    },
  });
}
