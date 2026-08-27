import { auth } from "@/lib/auth";
import { GoogleHealthError } from "@/lib/google-health.server";

export const GOOGLE_HEALTH_SCOPE =
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";

const HEALTH_SCOPE_MARKER = "googlehealth.activity_and_fitness.readonly";

export type GoogleHealthConnectionStatus =
  | { status: "connected" }
  | { status: "not_connected" }
  | {
      status: "reconnect_required";
      reason: "missing_scope" | "missing_refresh_token" | "refresh_failed";
    };

export type HealthApiErrorCode =
  | "UNAUTHENTICATED"
  | "GOOGLE_HEALTH_NOT_CONNECTED"
  | "GOOGLE_HEALTH_RECONNECT_REQUIRED"
  | "GOOGLE_HEALTH_UNAVAILABLE";

export type HealthApiError = {
  code: HealthApiErrorCode;
  message: string;
};

export type GoogleHealthAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: HealthApiError };

export type GoogleHealthConnectionResult =
  | { ok: true; status: GoogleHealthConnectionStatus }
  | { ok: false; error: HealthApiError };

export type GoogleHealthOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: HealthApiError };

type ResolvedHealthAccount =
  | { kind: "unauthenticated" }
  | { kind: "not_connected" }
  | {
      kind: "reconnect_required";
      reason: "missing_scope" | "missing_refresh_token" | "refresh_failed";
    }
  | { kind: "connected"; accountId: string };

async function resolveHealthAccount(
  request: Request,
): Promise<ResolvedHealthAccount> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return { kind: "unauthenticated" };
  }

  const accounts = await auth.api.listUserAccounts({
    headers: request.headers,
  });

  const googleAccount = accounts.find(
    (account) => account.providerId === "google",
  );

  if (!googleAccount) {
    return { kind: "not_connected" };
  }

  const grantedHealthScope = googleAccount.scopes.some((scope) =>
    scope.includes(HEALTH_SCOPE_MARKER),
  );

  if (!grantedHealthScope) {
    return { kind: "reconnect_required", reason: "missing_scope" };
  }

  return { kind: "connected", accountId: googleAccount.id };
}

function unresolvedError(resolved: ResolvedHealthAccount): HealthApiError {
  if (resolved.kind === "unauthenticated") {
    return {
      code: "UNAUTHENTICATED",
      message: "You must be signed in to view Google Health data.",
    };
  }
  if (resolved.kind === "not_connected") {
    return {
      code: "GOOGLE_HEALTH_NOT_CONNECTED",
      message: "Connect Google Health first.",
    };
  }
  return reconnectRequiredError();
}

function reconnectRequiredError(): HealthApiError {
  return {
    code: "GOOGLE_HEALTH_RECONNECT_REQUIRED",
    message: "Your Google Health connection needs to be re-established.",
  };
}


export async function getGoogleHealthAccessToken(
  request: Request,
): Promise<GoogleHealthAccessTokenResult> {
  const resolved = await resolveHealthAccount(request);

  if (resolved.kind !== "connected") {
    return { ok: false, error: unresolvedError(resolved) };
  }

  try {
    const tokens = await auth.api.getAccessToken({
      headers: request.headers,
      body: { accountId: resolved.accountId },
    });

    if (!tokens.accessToken) {
      return {
        ok: false,
        error: {
          code: "GOOGLE_HEALTH_RECONNECT_REQUIRED",
          message: "Your Google Health connection needs to be re-established.",
        },
      };
    }

    return { ok: true, accessToken: tokens.accessToken };
  } catch {
    return {
      ok: false,
      error: {
        code: "GOOGLE_HEALTH_RECONNECT_REQUIRED",
        message: "Your Google Health connection needs to be re-established.",
      },
    };
  }
}

export async function getGoogleHealthConnectionStatus(
  request: Request,
): Promise<GoogleHealthConnectionResult> {
  const resolved = await resolveHealthAccount(request);

  if (resolved.kind === "unauthenticated") {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "You must be signed in to view Google Health data.",
      },
    };
  }

  if (resolved.kind === "not_connected") {
    return { ok: true, status: { status: "not_connected" } };
  }

  if (resolved.kind === "reconnect_required") {
    return {
      ok: true,
      status: { status: "reconnect_required", reason: resolved.reason },
    };
  }

  try {
    await auth.api.getAccessToken({
      headers: request.headers,
      body: { accountId: resolved.accountId },
    });
    return { ok: true, status: { status: "connected" } };
  } catch {
    return {
      ok: true,
      status: { status: "reconnect_required", reason: "refresh_failed" },
    };
  }
}

/**
 * Runs a Google Health operation with a valid access token, retrying exactly
 * once after an unexpected Google 401.
 *
 * Resolves the linked Better Auth Google account, fetches a valid access
 * token (silently refreshing an expired one), and runs `operation`. If the
 * operation fails with a 401 (the token was revoked before its recorded
 * expiry), the provider token is refreshed once and the operation retried a
 * single time.
 *
 * Non-401 data errors (429, 5xx, network timeouts, malformed data) are
 * rethrown so callers can present them as retryable failures rather than a
 * lost connection.
 */
export async function withGoogleHealthAccessToken<T>(
  request: Request,
  operation: (accessToken: string) => Promise<T>,
): Promise<GoogleHealthOperationResult<T>> {
  const resolved = await resolveHealthAccount(request);

  if (resolved.kind !== "connected") {
    return { ok: false, error: unresolvedError(resolved) };
  }
  const accountId = resolved.accountId;

  const readToken = async () => {
    const tokens = await auth.api.getAccessToken({
      headers: request.headers,
      body: { accountId },
    });

    if (!tokens.accessToken) {
      throw new Error("Google Health returned no access token.");
    }

    return tokens.accessToken;
  };

  let accessToken: string;
  try {
    accessToken = await readToken();
  } catch {
    return { ok: false, error: reconnectRequiredError() };
  }

  try {
    return { ok: true, data: await operation(accessToken) };
  } catch (error) {
    if (!(error instanceof GoogleHealthError) || error.status !== 401) {
      throw error;
    }
  }

  let refreshedToken: string;
  try {
    await auth.api.refreshToken({
      headers: request.headers,
      body: { accountId },
    });
    refreshedToken = await readToken();
  } catch {
    return { ok: false, error: reconnectRequiredError() };
  }

  try {
    return { ok: true, data: await operation(refreshedToken) };
  } catch (error) {
    if (error instanceof GoogleHealthError && error.status === 401) {
      return { ok: false, error: reconnectRequiredError() };
    }
    throw error;
  }
}
