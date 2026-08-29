import { resolveGoogleAccount } from "@/lib/google-connection/account.server";
import {
  readGoogleAccessToken,
  runWithGoogleAccessToken,
} from "@/lib/google-connection/access-token.server";
import { disconnectGoogleConnection } from "@/lib/google-connection/disconnect.server";
import {
  googleConnectionErrors,
  type GoogleConnectionError,
  type GoogleConnectionOptions,
  type GoogleConnectionResult,
  type GoogleOperationOptions,
  type GoogleOperationResult,
} from "@/lib/google-connection/model";

export { disconnectGoogleConnection };
export type {
  GoogleConnectionError,
  GoogleConnectionErrorCode,
  GoogleConnectionOptions,
  GoogleConnectionResult,
  GoogleConnectionStatus,
  GoogleDisconnectResult,
  GoogleOperationOptions,
  GoogleOperationResult,
} from "@/lib/google-connection/model";

function unresolvedError(
  resolved: Exclude<
    Awaited<ReturnType<typeof resolveGoogleAccount>>,
    { kind: "connected" }
  >,
): GoogleConnectionError {
  if (resolved.kind === "unauthenticated") {
    return googleConnectionErrors.unauthenticated();
  }
  if (resolved.kind === "not_connected") {
    return googleConnectionErrors.notConnected();
  }
  return googleConnectionErrors.reconnectRequired();
}

export async function getGoogleConnectionStatus(
  request: Request,
  options: GoogleConnectionOptions = {},
): Promise<GoogleConnectionResult> {
  let account: Awaited<ReturnType<typeof resolveGoogleAccount>>;
  try {
    account = await resolveGoogleAccount(request, options.requiredScopes);
  } catch {
    return { ok: false, error: googleConnectionErrors.unavailable() };
  }

  if (account.kind === "unauthenticated") {
    return { ok: false, error: googleConnectionErrors.unauthenticated() };
  }
  if (account.kind === "not_connected") {
    return { ok: true, status: { status: "not_connected" } };
  }
  if (account.kind === "reconnect_required") {
    return {
      ok: true,
      status: { status: "reconnect_required", reason: account.reason },
    };
  }

  const token = await readGoogleAccessToken(request, account.accountId);
  if (token.status === "reconnect_required") {
    return {
      ok: true,
      status: { status: "reconnect_required", reason: "refresh_failed" },
    };
  }
  if (token.status === "temporarily_unavailable") {
    return { ok: false, error: googleConnectionErrors.unavailable() };
  }

  return { ok: true, status: { status: "connected" } };
}

export async function withGoogleAccessToken<T>(
  request: Request,
  options: GoogleOperationOptions,
  operation: (accessToken: string) => Promise<T>,
): Promise<GoogleOperationResult<T>> {
  let account: Awaited<ReturnType<typeof resolveGoogleAccount>>;
  try {
    account = await resolveGoogleAccount(request, options.requiredScopes);
  } catch {
    return { ok: false, error: googleConnectionErrors.unavailable() };
  }

  if (account.kind !== "connected") {
    return { ok: false, error: unresolvedError(account) };
  }

  const result = await runWithGoogleAccessToken(
    request,
    account.accountId,
    operation,
    options.isUnauthorized,
  );

  if (result.status === "success") {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    error:
      result.status === "reconnect_required"
        ? googleConnectionErrors.reconnectRequired()
        : googleConnectionErrors.unavailable(),
  };
}
