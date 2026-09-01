// @ts-ignore node:test types are not bundled under @cloudflare/workers-types
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveCfAccountIdFromToken } from "./cloudflare-account.ts";

describe("resolveCfAccountIdFromToken", () => {
  it("returns the first 32-char hex account id", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      assert.match(String(input), /\/accounts\?/);
      return new Response(
        JSON.stringify({
          success: true,
          result: [
            { id: "not-an-id" },
            { id: "3adf03d991843094a7343eebc0a98007" },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const id = await resolveCfAccountIdFromToken("token");
      assert.equal(id, "3adf03d991843094a7343eebc0a98007");
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("returns null when the token cannot list accounts", async () => {
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
