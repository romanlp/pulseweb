import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GoogleOAuthRevocationError,
  revokeGoogleOAuthToken,
  revokeThenUnlinkGoogleAccount,
} from "./revocation.server.ts";

describe("revokeGoogleOAuthToken", () => {
  it("posts the token to Google's revocation endpoint", async () => {
    let request: Request | undefined;

    await revokeGoogleOAuthToken("refresh token", async (input, init) => {
      request = new Request(input, init);
      return new Response(null, { status: 200 });
    });

    assert.equal(request?.url, "https://oauth2.googleapis.com/revoke");
    assert.equal(request?.method, "POST");
    assert.equal(
      request?.headers.get("content-type"),
      "application/x-www-form-urlencoded",
    );
    assert.equal(await request?.text(), "token=refresh+token");
  });

  it("allows retrying after Google already revoked the token", async () => {
    await revokeGoogleOAuthToken(
      "already-revoked",
      async () =>
        Response.json({ error: "invalid_token" }, { status: 400 }),
    );
  });

  it("reports when Google is unavailable", async () => {
    await assert.rejects(
      revokeGoogleOAuthToken(
        "refresh-token",
        async () => new Response(null, { status: 503 }),
      ),
      (error: unknown) =>
        error instanceof GoogleOAuthRevocationError && error.status === 503,
    );
  });
});

describe("revokeThenUnlinkGoogleAccount", () => {
  it("revokes the grant before unlinking the local account", async () => {
    const calls: string[] = [];

    await revokeThenUnlinkGoogleAccount(
      "refresh-token",
      async () => {
        calls.push("unlink");
      },
      async () => {
        calls.push("revoke");
      },
    );

    assert.deepEqual(calls, ["revoke", "unlink"]);
  });

  it("does not unlink when grant revocation fails", async () => {
    let unlinked = false;

    await assert.rejects(
      revokeThenUnlinkGoogleAccount(
        "refresh-token",
        async () => {
          unlinked = true;
        },
        async () => {
          throw new GoogleOAuthRevocationError(503);
        },
      ),
      GoogleOAuthRevocationError,
    );

    assert.equal(unlinked, false);
  });
});
