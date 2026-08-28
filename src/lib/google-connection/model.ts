export type GoogleConnectionStatus =
  | { status: "connected" }
  | { status: "not_connected" }
  | {
      status: "reconnect_required";
      reason: "missing_scope" | "missing_refresh_token" | "refresh_failed";
    };

export type GoogleConnectionErrorCode =
  | "UNAUTHENTICATED"
  | "GOOGLE_NOT_CONNECTED"
  | "GOOGLE_RECONNECT_REQUIRED"
  | "GOOGLE_UNAVAILABLE";

export type GoogleConnectionError = {
  code: GoogleConnectionErrorCode;
  message: string;
};

export type GoogleConnectionResult =
  | { ok: true; status: GoogleConnectionStatus }
  | { ok: false; error: GoogleConnectionError };

export type GoogleOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: GoogleConnectionError };

export type GoogleDisconnectResult =
  | { ok: true }
  | { ok: false; error: GoogleConnectionError };

export type GoogleConnectionOptions = {
  requiredScopes?: readonly string[];
};

export type GoogleOperationOptions = GoogleConnectionOptions & {
  isUnauthorized: (error: unknown) => boolean;
};

export const googleConnectionErrors = {
  unauthenticated: (): GoogleConnectionError => ({
    code: "UNAUTHENTICATED",
    message: "You must be signed in to use your Google connection.",
  }),
  notConnected: (): GoogleConnectionError => ({
    code: "GOOGLE_NOT_CONNECTED",
    message: "Connect your Google account first.",
  }),
  reconnectRequired: (): GoogleConnectionError => ({
    code: "GOOGLE_RECONNECT_REQUIRED",
    message: "Your Google connection needs to be re-established.",
  }),
  unavailable: (): GoogleConnectionError => ({
    code: "GOOGLE_UNAVAILABLE",
    message: "Google is temporarily unavailable. Try again shortly.",
  }),
};
