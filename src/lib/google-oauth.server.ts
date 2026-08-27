const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_HEALTH_SCOPE =
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export function getGoogleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appOrigin = process.env.APP_ORIGIN;

  if (!clientId || !clientSecret || !appOrigin) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_ORIGIN must be set.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appOrigin.replace(/\/$/, "")}/api/auth/google/callback`,
  };
}

export function createGoogleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getGoogleConfig();
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_HEALTH_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("access_type", "online");

  return url.toString();
}

export async function exchangeCodeForAccessToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description ?? body.error ?? "Google token exchange failed.",
    );
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 3600,
  };
}

export function createRandomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie") ?? "";

  for (const item of cookieHeader.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }

  return undefined;
}

export function cookie(
  name: string,
  value: string,
  options: { maxAge?: number; secure?: boolean } = {},
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (options.secure) parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);

  return parts.join("; ");
}
