import {
  withGoogleAccessToken,
  type GoogleConnectionError,
} from "@/lib/google-connection/index.server";
import { GOOGLE_HEALTH_SCOPES } from "@/lib/google-health-config";
import { GoogleHealthError } from "@/lib/google-health.server";

export function healthApiErrorStatus(error: GoogleConnectionError) {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "GOOGLE_UNAVAILABLE") return 503;
  return 409;
}

export async function handleHealthOperation<T>(
  request: Request,
  operation: (accessToken: string) => Promise<T>,
): Promise<Response> {
  let result;

  try {
    result = await withGoogleAccessToken(
      request,
      {
        requiredScopes: GOOGLE_HEALTH_SCOPES,
        isUnauthorized: (error) =>
          error instanceof GoogleHealthError && error.status === 401,
      },
      operation,
    );
  } catch (error) {
    const googleError =
      error instanceof GoogleHealthError ? error : undefined;

    return Response.json(
      {
        code: "GOOGLE_HEALTH_UNAVAILABLE",
        message:
          googleError?.message ??
          "Google Health is temporarily unavailable. Try again shortly.",
      },
      {
        status: googleError && googleError.status < 500 ? googleError.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (!result.ok) {
    return Response.json(result.error, {
      status: healthApiErrorStatus(result.error),
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
