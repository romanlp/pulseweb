const GOOGLE_OAUTH_REVOCATION_URL = "https://oauth2.googleapis.com/revoke";

type Fetcher = typeof fetch;
type RevokeToken = (token: string) => Promise<void>;

export class GoogleOAuthRevocationError extends Error {
  readonly status?: number;

  constructor(status?: number) {
    super("Google OAuth token revocation failed.");
    this.name = "GoogleOAuthRevocationError";
    this.status = status;
  }
}

export async function revokeGoogleOAuthToken(
  token: string,
  fetcher: Fetcher = fetch,
) {
  let response: Response;

  try {
    response = await fetcher(GOOGLE_OAUTH_REVOCATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    throw new GoogleOAuthRevocationError();
  }

  if (response.ok) return;

  const body = await response
    .clone()
    .json<{ error?: string }>()
    .catch(() => undefined);

  // A previous attempt may have revoked the grant before local unlinking
  // completed. Treat Google's invalid-token response as idempotent success.
  if (response.status === 400 && body?.error === "invalid_token") return;

  throw new GoogleOAuthRevocationError(response.status);
}

export async function revokeThenUnlinkGoogleAccount(
  token: string | undefined,
  unlink: () => Promise<unknown>,
  revoke: RevokeToken = revokeGoogleOAuthToken,
) {
  if (token) await revoke(token);
  await unlink();
}
