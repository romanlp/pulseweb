import { decryptOAuthToken } from "better-auth/oauth2";

import { auth } from "@/lib/auth";
import { findGoogleAccountForDisconnect } from "@/lib/google-connection/account.server";
import {
  googleConnectionErrors,
  type GoogleDisconnectResult,
} from "@/lib/google-connection/model";
import { revokeThenUnlinkGoogleAccount } from "@/lib/google-connection/revocation.server";

export async function disconnectGoogleConnection(
  request: Request,
): Promise<GoogleDisconnectResult> {
  try {
    const account = await findGoogleAccountForDisconnect(request);

    if (account.kind === "unauthenticated") {
      return { ok: false, error: googleConnectionErrors.unauthenticated() };
    }
    if (account.kind === "not_connected") return { ok: true };

    const authContext: unknown = await auth.$context;
    // SAFETY: Better Auth supplies this context to the same helper internally;
    // its public generic is invariant in the configured auth options.
    const decryptContext = authContext as Parameters<typeof decryptOAuthToken>[1];
    const token = account.encryptedToken
      ? await decryptOAuthToken(
          account.encryptedToken,
          decryptContext,
        )
      : undefined;

    await revokeThenUnlinkGoogleAccount(token, async () => {
      await auth.api.unlinkAccount({
        headers: request.headers,
        body: { accountId: account.accountId },
      });
    });

    return { ok: true };
  } catch {
    return { ok: false, error: googleConnectionErrors.unavailable() };
  }
}
