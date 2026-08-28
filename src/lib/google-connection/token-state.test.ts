import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasUsableAccessToken,
  resolveUsableAccessToken,
} from "./token-state.ts";

const now = Date.parse("2026-08-27T12:00:00.000Z");

describe("hasUsableAccessToken", () => {
  it("accepts a non-empty token with a future expiry", () => {
    assert.equal(
      hasUsableAccessToken(
        {
          accessToken: "access-token",
          accessTokenExpiresAt: "2026-08-27T13:00:00.000Z",
        },
        now,
      ),
      true,
    );
  });

  it("rejects a missing token", () => {
    assert.equal(
      hasUsableAccessToken(
        { accessTokenExpiresAt: "2026-08-27T13:00:00.000Z" },
        now,
      ),
      false,
    );
  });

  it("rejects an expired token", () => {
    assert.equal(
      hasUsableAccessToken(
        {
          accessToken: "access-token",
          accessTokenExpiresAt: "2026-08-27T11:59:59.000Z",
        },
        now,
      ),
      false,
    );
  });

  it("rejects an invalid expiry", () => {
    assert.equal(
      hasUsableAccessToken(
        { accessToken: "access-token", accessTokenExpiresAt: "invalid" },
        now,
      ),
      false,
    );
  });

  it("rejects a token with no expiry", () => {
    assert.equal(hasUsableAccessToken({ accessToken: "access-token" }, now), false);
  });
});

describe("resolveUsableAccessToken", () => {
  it("returns a usable token when the provider read succeeds", async () => {
    const result = await resolveUsableAccessToken(
      async () => ({
        accessToken: "access-token",
        accessTokenExpiresAt: "2026-08-27T13:00:00.000Z",
      }),
      now,
    );

    assert.deepEqual(result, {
      status: "usable",
      accessToken: "access-token",
    });
  });

  it("requires reconnect after a successful read returns no usable token", async () => {
    const result = await resolveUsableAccessToken(
      async () => ({
        accessToken: "expired-token",
        accessTokenExpiresAt: "2026-08-27T11:59:59.000Z",
      }),
      now,
    );

    assert.deepEqual(result, { status: "reconnect_required" });
  });

  it("treats a failed token read as temporarily unavailable", async () => {
    const result = await resolveUsableAccessToken(
      async () => {
        throw new Error("provider timeout");
      },
      now,
    );

    assert.deepEqual(result, { status: "temporarily_unavailable" });
  });
});
