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

    const token = account.encryptedToken
      ? await decryptOAuthToken(
          account.encryptedToken,
          // Better Auth's exported helper loses the concrete options generic.
          (await auth.$context) as unknown as Parameters<
            typeof decryptOAuthToken
          >[1],
        )
      : undefined;

    await revokeThenUnlinkGoogleAccount(token, () =>
      auth.api.unlinkAccount({
        headers: request.headers,
        body: { accountId: account.accountId },
      }),
    );

    return { ok: true };
  } catch {
    return { ok: false, error: googleConnectionErrors.unavailable() };
  }
}
