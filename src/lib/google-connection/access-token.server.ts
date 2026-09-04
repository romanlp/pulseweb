import { auth } from "@/lib/auth";
import { resolveUsableAccessToken } from "@/lib/google-connection/token-state";

export type AccessTokenOperationResult<T> =
  | { status: "success"; data: T }
  | { status: "reconnect_required" }
  | { status: "temporarily_unavailable" };

export async function readGoogleAccessToken(
  request: Request,
  accountId: string,
) {
  return resolveUsableAccessToken(() =>
    auth.api.getAccessToken({
      headers: request.headers,
      body: { accountId },
    }),
  );
}

export async function runWithGoogleAccessToken<T>(
  request: Request,
  accountId: string,
  operation: (accessToken: string) => Promise<T>,
  isUnauthorized: (error: Error) => boolean,
): Promise<AccessTokenOperationResult<T>> {
  const initialToken = await readGoogleAccessToken(request, accountId);
  if (initialToken.status !== "usable") return initialToken;

  try {
    return {
      status: "success",
      data: await operation(initialToken.accessToken),
    };
  } catch (error) {
    if (!(error instanceof Error) || !isUnauthorized(error)) throw error;
  }

  let refreshedTokens;
  try {
    refreshedTokens = await auth.api.refreshToken({
      headers: request.headers,
      body: { accountId },
    });
  } catch {
    // Better Auth does not preserve Google's OAuth error reason here, so this
    // could be either an invalid grant or a transient provider/storage error.
    return { status: "temporarily_unavailable" };
  }

  const refreshedToken = await resolveUsableAccessToken(
    async () => refreshedTokens,
  );
  if (refreshedToken.status !== "usable") return refreshedToken;

  try {
    return {
      status: "success",
      data: await operation(refreshedToken.accessToken),
    };
  } catch (error) {
    if (error instanceof Error && isUnauthorized(error)) {
      return { status: "reconnect_required" };
    }
    throw error;
  }
}
