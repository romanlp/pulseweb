# Google Health Account Linking Plan

## Status

- Status: Planned
- Scope: Replace the temporary browser-session Google Health OAuth flow with a persistent Google account linked to the signed-in Better Auth user.
- Target runtime: TanStack Start on Cloudflare Workers with Cloudflare D1.

## Goal

A user should be able to:

1. Create or sign in to a Pulseweb account with Better Auth.
2. Explicitly connect a Google account and authorize read-only Google Health activity access.
3. Return in a later browser session, sign in to the same Pulseweb account, and continue reading Google Health data without authorizing Google again.
4. See a clear reconnect banner only when Google authorization can no longer be refreshed.

The Better Auth user ID is the durable owner of the Google connection. Google access and refresh tokens are stored in the existing Better Auth `account` row in D1, not in browser cookies.

## Non-goals

- Adding sleep, health-metrics, location, nutrition, ECG, or other Google Health scopes.
- Background syncing or scheduled data ingestion.
- Persisting Google Health measurements in Pulseweb's database.
- Building a complete connections/settings management area.
- Production-grade token encryption as part of this POC. Token encryption remains a production follow-up.

## Current State

The current POC uses a custom Google OAuth flow:

- `src/routes/api/auth/google.ts` starts authorization.
- `src/routes/api/auth/google/callback.ts` exchanges the authorization code.
- `src/lib/google-oauth.server.ts` constructs OAuth requests and exchanges tokens.
- The short-lived access token is stored in the HTTP-only `google_health_access_token` cookie.
- `src/routes/api/health/summary.ts` and `src/routes/api/health/steps.ts` read that cookie directly.
- Once the access token expires, the user must connect Google again.

Better Auth is already configured with Google as a social provider. Its existing D1 `account` table contains the fields needed for persistent linking:

- `user_id`
- `provider_id`
- `access_token`
- `refresh_token`
- `access_token_expires_at`
- `refresh_token_expires_at`
- `scope`

No schema migration is expected. The existing auth migration must be confirmed as applied locally and remotely.

## Target Flow

```text
Pulseweb login
    ↓
Authenticated Better Auth user
    ↓
Explicit Connect Google Health action
    ↓
Better Auth links a Google account to the Pulseweb user ID
    ↓
Google access and refresh tokens are stored in the D1 account row
    ↓
Health endpoint asks Better Auth for a valid access token
    ├─ Access token is valid → fetch Google Health data
    ├─ Access token expired → refresh silently and persist new token
    └─ Refresh rejected → return reconnect_required
```

## Connection Contract

Expose application-level states rather than Better Auth or Google error details:

```ts
type GoogleHealthConnectionStatus =
  | { status: "connected" }
  | { status: "not_connected" }
  | {
      status: "reconnect_required";
      reason: "missing_scope" | "missing_refresh_token" | "refresh_failed";
    };
```

Health endpoints should use stable error codes:

```ts
type HealthApiError = {
  code:
    | "UNAUTHENTICATED"
    | "GOOGLE_HEALTH_NOT_CONNECTED"
    | "GOOGLE_HEALTH_RECONNECT_REQUIRED"
    | "GOOGLE_HEALTH_UNAVAILABLE";
  message: string;
};
```

HTTP status meanings:

- `401`: The Pulseweb Better Auth session is missing.
- `409`: The user is signed in, but Google Health must be connected or reconnected.
- `429`: Google rate-limited the request; offer retry.
- `500` or `502`: Temporary application or Google failure; offer retry.

Access-token expiry alone must never trigger a reconnect banner. Better Auth should refresh access tokens silently. The banner is reserved for a missing connection, missing permission, or a failed refresh.

## Implementation Increments

### Increment 1: Configure explicit Google account linking

Update `src/lib/auth.ts` to make the intended linking policy explicit:

```ts
account: {
  accountLinking: {
    enabled: true,
    disableImplicitLinking: true,
    trustedProviders: ["google"],
    allowDifferentEmails: true,
  },
},
```

Expected behavior:

- A Google account is linked only after an authenticated user explicitly starts linking.
- Signing in with a matching Google email must not silently merge accounts.
- A user may connect a Google/Fitbit account whose email differs from the Pulseweb login email.
- Better Auth must reject a Google account already linked to another Pulseweb user.

If product policy later requires matching emails, set `allowDifferentEmails` to `false`. For this POC, allowing different emails is recommended because application identity and health-provider identity may legitimately differ.

### Increment 2: Start OAuth through Better Auth

In `src/routes/_app/health.tsx`, replace the link to `/api/auth/google` with an explicit Better Auth linking action:

```ts
await authClient.linkSocial({
  provider: "google",
  callbackURL: "/health?connected=1",
  scopes: [
    "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  ],
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
});
```

Requirements:

- Keep the existing read-only activity scope.
- Request `access_type=offline` so Google can issue a refresh token.
- Request consent explicitly during linking so an existing Google authorization can return a usable refresh token.
- Treat the `connected=1` callback parameter only as a success hint. Server connection status remains authoritative.
- Show a pending state while Better Auth prepares the redirect.
- Surface a useful error if the redirect cannot be started.

Google Cloud must authorize Better Auth's callback URLs:

```text
http://localhost:3000/api/auth/callback/google
https://<production-domain>/api/auth/callback/google
```

Keep the old custom callback authorized until the new flow has passed real-account verification.

### Increment 3: Add a server-only Google Health connection helper

Create `src/lib/google-health-auth.server.ts`.

Responsibilities:

1. Read the Better Auth session from the incoming request headers.
2. Return `UNAUTHENTICATED` if no Pulseweb session exists.
3. Call `auth.api.listUserAccounts()` with the same request headers.
4. Find the linked account whose `providerId` is `google`.
5. Check that its stored scopes include `googlehealth.activity_and_fitness.readonly`.
6. Call `auth.api.getAccessToken()` using the Better Auth account record ID.
7. Return a valid access token only to server-side code.
8. Normalize Better Auth failures into the connection contract.

Conceptual server flow:

```ts
const session = await auth.api.getSession({
  headers: request.headers,
});

const accounts = await auth.api.listUserAccounts({
  headers: request.headers,
});

const googleAccount = accounts.find(
  (account) => account.providerId === "google",
);

const tokens = await auth.api.getAccessToken({
  headers: request.headers,
  body: {
    accountId: googleAccount.id,
  },
});
```

The browser must never receive the access token, refresh token, account token fields, or raw Better Auth token errors.

### Increment 4: Retry once after an unexpected Google 401

An access token can be revoked before its recorded expiry. Add a wrapper around Google Health operations:

1. Obtain the access token through Better Auth.
2. Call the Google Health operation.
3. If Google returns `401`, call `auth.api.refreshToken()` once.
4. Retry the Google Health operation once with the refreshed token.
5. If refresh or retry fails, return `GOOGLE_HEALTH_RECONNECT_REQUIRED`.
6. Never retry authorization in a loop.

Do not classify these as reconnect conditions:

- Google `429`
- Network timeout
- Google `500–599`
- Malformed or temporarily unavailable health data

These should remain retryable data-fetching errors.

### Increment 5: Add a connection-status endpoint

Create `src/routes/api/health/connection.ts`:

```text
GET /api/health/connection
```

Possible response bodies:

```json
{ "status": "connected" }
```

```json
{ "status": "not_connected" }
```

```json
{
  "status": "reconnect_required",
  "reason": "refresh_failed"
}
```

Requirements:

- Return `Cache-Control: no-store`.
- Require a valid Pulseweb session.
- Check account presence and granted scope.
- Call `getAccessToken()` so opening the Health page silently refreshes an expired access token.
- Never include OAuth tokens in the response.

### Increment 6: Update the Health UI

Update `src/routes/_app/health.tsx` to load `/api/health/connection` when the page opens.

Maintain separate state for:

- Connection-status loading
- Google connection status
- Linking progress
- Health summary loading
- Retryable summary errors

UI behavior by state:

#### Not connected

Show:

> Connect Google Health to see your activity.

Primary action: `Connect Google Health`.

Disable or hide `Fetch summary` until connected.

#### Connected

Show a subtle connected indicator and enable `Fetch summary`.

Do not claim the connection is valid based only on the callback query parameter.

#### Reconnect required

Show a persistent banner:

> Your Google Health connection has expired. Reconnect to continue syncing your activity.

Actions:

- Primary: `Reconnect Google Health`
- Optional secondary: `Not now`

The primary action starts the same `linkSocial()` flow.

#### Temporary failure

Show:

> Google Health is temporarily unavailable. Try again shortly.

Action: `Retry`.

Do not imply that authorization was lost.

After a successful callback, re-fetch connection status and clear `connected` and `error` from the URL search parameters.

### Increment 7: Migrate health data endpoints

Migrate `src/routes/api/health/summary.ts` first:

- Remove `readCookie("google_health_access_token")`.
- Resolve a valid token through `google-health-auth.server.ts`.
- Use the stable error codes.
- Preserve the current successful summary response shape.
- Preserve `Cache-Control: no-store`.

Verify this endpoint before migrating `src/routes/api/health/steps.ts` in the same way.

The existing Google Health data-fetching functions in `src/lib/google-health.server.ts` should continue accepting an access-token string. They should not know how the token is stored or refreshed.

### Increment 8: Remove the custom OAuth implementation

After the Better Auth flow passes real-account testing:

- Delete `src/routes/api/auth/google.ts`.
- Delete `src/routes/api/auth/google/callback.ts`.
- Delete `src/lib/google-oauth.server.ts`.
- Remove all `google_health_access_token` cookie handling.
- Remove all `google_oauth_state` cookie handling.
- Regenerate `src/routeTree.gen.ts`.
- Remove the old custom callback URL from Google Cloud after production migration.

Search for leftovers:

```bash
rg -n "google_health_access_token|google_oauth_state|google-oauth|/api/auth/google" src README.md
```

Expected result: no application references.

### Increment 9: Update documentation

Update `README.md` to document:

- Users sign into Pulseweb before connecting Google Health.
- Google is linked as a secondary Better Auth account.
- OAuth tokens are stored in D1 rather than browser cookies.
- Access tokens refresh automatically.
- Reconnection is required if Google revokes or rejects the refresh token.
- The authorized callback path is `/api/auth/callback/google`.
- Local and production origins must both be configured correctly.

Document Google's testing-mode limitation: an external OAuth app whose publishing status is `Testing` normally receives refresh tokens that expire after seven days. Long-lived connection acceptance cannot be completed until the OAuth app has the appropriate production publishing status.

## Verification Plan

### Automated checks

Run after each increment:

```bash
bun run generate-routes
bunx tsc --noEmit
bun run build
git diff --check
```

### Manual acceptance matrix

#### 1. Signed in, never connected

- Health page shows `Connect Google Health`.
- Health summary fetching is unavailable.
- No Google account row exists for the Pulseweb user.

#### 2. Successful first connection

- Google consent requests read-only activity access.
- One Google `account` row is linked to the current Better Auth `userId`.
- The stored scope includes the Google Health activity scope.
- A refresh token is stored.
- The Health page reports connected after the callback.

#### 3. Browser reload

- Health still reports connected.
- Google consent is not shown again.
- Summary fetching succeeds.

#### 4. New browser session

- Sign into the same Pulseweb account.
- Health reports connected without repeating Google consent.
- Summary fetching succeeds.

#### 5. Expired access token

- Set or wait for `access_token_expires_at` to be in the past.
- Opening Health or fetching the summary refreshes silently.
- Better Auth persists the refreshed access token and expiry.
- No reconnect banner appears.

#### 6. Missing or invalid refresh token

- Expire the access token and remove or invalidate the refresh token in a controlled local test.
- Connection status becomes `reconnect_required`.
- The reconnect banner appears.
- Raw provider errors and tokens are not exposed to the browser.

#### 7. Successful reconnection

- Complete Google consent again.
- The linked Google account remains associated with the same Pulseweb user.
- Stored token data is updated.
- The banner disappears and summary fetching succeeds.

#### 8. Google rate limit or outage

- Simulate Google `429` and `5xx` responses.
- UI offers retry.
- UI does not show a reconnect banner.

#### 9. Missing Health scope

- Simulate partial consent or remove the Health scope from the linked account.
- Status becomes `reconnect_required` with reason `missing_scope`.
- No Google Health request is attempted with insufficient permissions.

#### 10. Logged-out user

- Health endpoints return app-level `401`.
- The protected app layout redirects to login.
- Google linking cannot start without a Pulseweb session.

## Completion Criteria

The migration is complete when:

- Google tokens are associated with the Better Auth user in D1.
- No Google access token is stored in an application cookie.
- Access-token expiry is handled silently.
- Invalid refresh authorization produces a reconnect banner.
- Reloading or changing browser sessions does not require Google reconnection after signing into the same Pulseweb account.
- Temporary Google failures do not incorrectly trigger reconnection.
- The current health summary continues to work without changing its successful response contract.
- Old OAuth routes and cookie code are removed.
- README configuration instructions match the Better Auth callback flow.
- Route generation, type-check, build, and diff checks pass.
- Real Google account testing covers initial link, silent refresh, and forced reconnect.

## Production Follow-ups

These are intentionally outside the POC migration:

- Encrypt access and refresh tokens before database persistence.
- Add a user-facing `Disconnect Google Health` action that revokes authorization and unlinks the Better Auth account.
- Add structured logging for refresh failures without logging tokens.
- Add monitoring for repeated Google authorization failures.
- Complete any required Google OAuth publishing and verification work.
- Define a data-retention policy before persisting Google Health measurements.

## References

- Better Auth OAuth and account linking: <https://better-auth.com/docs/concepts/oauth>
- Better Auth users and accounts: <https://better-auth.com/docs/concepts/users-accounts>
- Better Auth Google provider: <https://better-auth.com/docs/authentication/google>
- Google OAuth web-server flow: <https://developers.google.com/identity/protocols/oauth2/web-server>
- Google refresh-token expiration: <https://developers.google.com/identity/protocols/oauth2#expiration>
