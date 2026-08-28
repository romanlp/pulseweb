import { and, eq } from "drizzle-orm";

import { account as accountTable } from "@/db/auth-schema";
import { getDb } from "@/db/db-client.server";
import { auth } from "@/lib/auth";
import { GoogleHealthError } from "@/lib/google-health.server";
import {
  resolveUsableAccessToken,
  type AccessTokenResolution,
} from "@/lib/google-health-token-state";

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

  const [storedAccount] = await getDb()
    .select({ refreshToken: accountTable.refreshToken })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.id, googleAccount.id),
        eq(accountTable.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!storedAccount?.refreshToken) {
    return { kind: "reconnect_required", reason: "missing_refresh_token" };
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

function temporarilyUnavailableError(): HealthApiError {
  return {
    code: "GOOGLE_HEALTH_UNAVAILABLE",
    message: "Google Health is temporarily unavailable. Try again shortly.",
  };
}

function tokenResolutionError(
  resolution: Exclude<AccessTokenResolution, { status: "usable" }>,
): HealthApiError {
  return resolution.status === "reconnect_required"
    ? reconnectRequiredError()
    : temporarilyUnavailableError();
}

async function readValidAccessToken(request: Request, accountId: string) {
  return resolveUsableAccessToken(() =>
    auth.api.getAccessToken({
      headers: request.headers,
      body: { accountId },
    }),
  );
}

export async function getGoogleHealthAccessToken(
  request: Request,
): Promise<GoogleHealthAccessTokenResult> {
  let resolved: ResolvedHealthAccount;
  try {
    resolved = await resolveHealthAccount(request);
  } catch {
    return { ok: false, error: temporarilyUnavailableError() };
  }

  if (resolved.kind !== "connected") {
    return { ok: false, error: unresolvedError(resolved) };
  }

  const token = await readValidAccessToken(request, resolved.accountId);
  if (token.status !== "usable") {
    return { ok: false, error: tokenResolutionError(token) };
  }

  return { ok: true, accessToken: token.accessToken };
}

export async function getGoogleHealthConnectionStatus(
  request: Request,
): Promise<GoogleHealthConnectionResult> {
  let resolved: ResolvedHealthAccount;
  try {
    resolved = await resolveHealthAccount(request);
  } catch {
    return { ok: false, error: temporarilyUnavailableError() };
  }

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

  const token = await readValidAccessToken(request, resolved.accountId);
  if (token.status === "reconnect_required") {
    return {
      ok: true,
      status: { status: "reconnect_required", reason: "refresh_failed" },
    };
  }
  if (token.status === "temporarily_unavailable") {
    return { ok: false, error: temporarilyUnavailableError() };
  }

  return { ok: true, status: { status: "connected" } };
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
  let resolved: ResolvedHealthAccount;
  try {
    resolved = await resolveHealthAccount(request);
  } catch {
    return { ok: false, error: temporarilyUnavailableError() };
  }

  if (resolved.kind !== "connected") {
    return { ok: false, error: unresolvedError(resolved) };
  }
  const accountId = resolved.accountId;

  const initialToken = await readValidAccessToken(request, accountId);
  if (initialToken.status !== "usable") {
    return { ok: false, error: tokenResolutionError(initialToken) };
  }

  try {
    return { ok: true, data: await operation(initialToken.accessToken) };
  } catch (error) {
    if (!(error instanceof GoogleHealthError) || error.status !== 401) {
      throw error;
    }
  }

  try {
    await auth.api.refreshToken({
      headers: request.headers,
      body: { accountId },
    });
  } catch {
    // Better Auth does not preserve Google's OAuth error reason here, so this
    // could be either an invalid grant or a transient provider/storage error.
    return { ok: false, error: temporarilyUnavailableError() };
  }

  const refreshedToken = await readValidAccessToken(request, accountId);
  if (refreshedToken.status !== "usable") {
    return { ok: false, error: tokenResolutionError(refreshedToken) };
  }

  try {
    return {
      ok: true,
      data: await operation(refreshedToken.accessToken),
    };
  } catch (error) {
    if (error instanceof GoogleHealthError && error.status === 401) {
      return { ok: false, error: reconnectRequiredError() };
    }
    throw error;
  }
}
