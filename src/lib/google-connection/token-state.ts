export type AccessTokenSnapshot = {
  accessToken?: string | null;
  accessTokenExpiresAt?: Date | string | null;
};

export type AccessTokenResolution =
  | { status: "usable"; accessToken: string }
  | { status: "reconnect_required" }
  | { status: "temporarily_unavailable" };

export function hasUsableAccessToken(
  snapshot: AccessTokenSnapshot,
  now = Date.now(),
) {
  if (!snapshot.accessToken) return false;
  if (!snapshot.accessTokenExpiresAt) return false;

  const expiresAt = new Date(snapshot.accessTokenExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export async function resolveUsableAccessToken(
  readToken: () => Promise<AccessTokenSnapshot>,
  now = Date.now(),
): Promise<AccessTokenResolution> {
  try {
    const snapshot = await readToken();

    if (!hasUsableAccessToken(snapshot, now) || !snapshot.accessToken) {
      return { status: "reconnect_required" };
    }

    return { status: "usable", accessToken: snapshot.accessToken };
  } catch {
    // Better Auth normalizes provider, network, and storage failures into the
    // same error, so a rejected read is not proof that consent was revoked.
    return { status: "temporarily_unavailable" };
  }
}
