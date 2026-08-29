import { and, eq } from "drizzle-orm";

import { account as accountTable } from "@/db/auth-schema";
import { getDb } from "@/db/db-client.server";
import { auth } from "@/lib/auth";

export type ResolvedGoogleAccount =
  | { kind: "unauthenticated" }
  | { kind: "not_connected" }
  | {
      kind: "reconnect_required";
      reason: "missing_scope" | "missing_refresh_token";
    }
  | { kind: "connected"; accountId: string };

export type GoogleAccountForDisconnect =
  | { kind: "unauthenticated" }
  | { kind: "not_connected" }
  | {
      kind: "connected";
      accountId: string;
      encryptedToken?: string;
    };

type LinkedGoogleAccount = {
  accountId: string;
  scopes: string[];
  userId: string;
};

async function findLinkedGoogleAccount(
  request: Request,
): Promise<
  | { kind: "unauthenticated" }
  | { kind: "not_connected" }
  | { kind: "connected"; account: LinkedGoogleAccount }
> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { kind: "unauthenticated" };

  const accounts = await auth.api.listUserAccounts({
    headers: request.headers,
  });
  const googleAccount = accounts.find(
    (account) => account.providerId === "google",
  );

  if (!googleAccount) return { kind: "not_connected" };

  return {
    kind: "connected",
    account: {
      accountId: googleAccount.id,
      scopes: googleAccount.scopes,
      userId: session.user.id,
    },
  };
}

export async function resolveGoogleAccount(
  request: Request,
  requiredScopes: readonly string[] = [],
): Promise<ResolvedGoogleAccount> {
  const linked = await findLinkedGoogleAccount(request);
  if (linked.kind !== "connected") return linked;

  const hasRequiredScopes = requiredScopes.every((requiredScope) =>
    linked.account.scopes.includes(requiredScope),
  );
  if (!hasRequiredScopes) {
    return { kind: "reconnect_required", reason: "missing_scope" };
  }

  const [storedAccount] = await getDb()
    .select({ refreshToken: accountTable.refreshToken })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.id, linked.account.accountId),
        eq(accountTable.userId, linked.account.userId),
      ),
    )
    .limit(1);

  if (!storedAccount?.refreshToken) {
    return { kind: "reconnect_required", reason: "missing_refresh_token" };
  }

  return { kind: "connected", accountId: linked.account.accountId };
}

export async function findGoogleAccountForDisconnect(
  request: Request,
): Promise<GoogleAccountForDisconnect> {
  const linked = await findLinkedGoogleAccount(request);
  if (linked.kind !== "connected") return linked;

  const [storedAccount] = await getDb()
    .select({
      accessToken: accountTable.accessToken,
      refreshToken: accountTable.refreshToken,
    })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.id, linked.account.accountId),
        eq(accountTable.userId, linked.account.userId),
      ),
    )
    .limit(1);

  return {
    kind: "connected",
    accountId: linked.account.accountId,
    encryptedToken:
      storedAccount?.refreshToken ?? storedAccount?.accessToken ?? undefined,
  };
}
