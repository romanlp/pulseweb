import { authClient } from "@/lib/auth-client";

type ConnectGoogleAccountOptions = {
  callbackURL: string;
  scopes: readonly string[];
};

export async function connectGoogleAccount({
  callbackURL,
  scopes,
}: ConnectGoogleAccountOptions) {
  const result = await authClient.linkSocial({
    provider: "google",
    callbackURL,
    scopes: [...scopes],
    additionalParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  if (result.error) {
    throw new Error(
      result.error?.message ?? "Unable to start Google account linking.",
    );
  }
}
