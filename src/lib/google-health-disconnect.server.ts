import { and, eq } from "drizzle-orm";
import { decryptOAuthToken } from "better-auth/oauth2";

import { account as accountTable } from "@/db/auth-schema";
import { getDb } from "@/db/db-client.server";
import { auth } from "@/lib/auth";
import type { HealthApiError } from "@/lib/google-health-auth.server";
import { revokeThenUnlinkGoogleAccount } from "@/lib/google-oauth-revocation.server";

export type GoogleHealthDisconnectResult =
  | { ok: true }
  | { ok: false; error: HealthApiError };

const unauthenticatedError = (): HealthApiError => ({
  code: "UNAUTHENTICATED",
  message: "You must be signed in to disconnect Google Health.",
});

const unavailableError = (): HealthApiError => ({
  code: "GOOGLE_HEALTH_UNAVAILABLE",
  message: "Google Health could not be disconnected. Try again shortly.",
});

export async function disconnectGoogleHealth(
  request: Request,
): Promise<GoogleHealthDisconnectResult> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return { ok: false, error: unauthenticatedError() };

    const accounts = await auth.api.listUserAccounts({
      headers: request.headers,
    });
    const googleAccount = accounts.find(
      (account) => account.providerId === "google",
    );

    // Disconnect is idempotent: there is nothing left to revoke or unlink.
    if (!googleAccount) return { ok: true };

    const [storedAccount] = await getDb()
      .select({
        accessToken: accountTable.accessToken,
        refreshToken: accountTable.refreshToken,
      })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.id, googleAccount.id),
          eq(accountTable.userId, session.user.id),
        ),
      )
      .limit(1);

    const encryptedToken =
      storedAccount?.refreshToken ?? storedAccount?.accessToken;

    const token = encryptedToken
      ? await decryptOAuthToken(
          encryptedToken,
          // Better Auth's exported helper loses the concrete options generic.
          (await auth.$context) as unknown as Parameters<
            typeof decryptOAuthToken
          >[1],
        )
      : undefined;

    await revokeThenUnlinkGoogleAccount(token, () =>
      auth.api.unlinkAccount({
        headers: request.headers,
        body: { accountId: googleAccount.id },
      }),
    );

    return { ok: true };
  } catch {
    return { ok: false, error: unavailableError() };
  }
}
