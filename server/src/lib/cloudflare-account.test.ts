// @ts-ignore node:test types are not bundled under @cloudflare/workers-types
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveCfAccountIdFromToken } from "./cloudflare-account.ts";

const ACCOUNT = "3adf03d991843094a7343eebc0a98007";

describe("resolveCfAccountIdFromToken", () => {
  it("reads account.id from the first zone (Zone Read token)", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      assert.match(String(input), /\/zones\?/);
      return new Response(
        JSON.stringify({
          success: true,
          result: [{ id: "zone-1", account: { id: ACCOUNT } }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      assert.equal(await resolveCfAccountIdFromToken("token"), ACCOUNT);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("falls back to GET /accounts when zones have no account id", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/zones?")) {
        return new Response(
          JSON.stringify({ success: true, result: [{ id: "zone-1" }] }),
          { status: 200 },
        );
      }
      assert.match(url, /\/accounts\?/);
      return new Response(
        JSON.stringify({
          success: true,
          result: [{ id: "not-an-id" }, { id: ACCOUNT }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      assert.equal(await resolveCfAccountIdFromToken("token"), ACCOUNT);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("returns null when the token cannot list zones or accounts", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 403,
      })) as typeof fetch;
    try {
      assert.equal(await resolveCfAccountIdFromToken("token"), null);
      assert.equal(await resolveCfAccountIdFromToken("  "), null);
    } finally {
      globalThis.fetch = previous;
    }
  });
});
