// @ts-ignore node:test types are not bundled under @cloudflare/workers-types
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CloudflareClient } from "./cloudflare-client.ts";

const ACCOUNT_A = "3adf03d991843094a7343eebc0a98007";
const ACCOUNT_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function jsonOk(result: unknown): Response {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
  });
}

describe("CloudflareClient.listZones", () => {
  it("requests and returns only the pinned account's zones", async () => {
    const seen: string[] = [];
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return jsonOk([
        {
          id: "z1",
          name: "relaybase.xyz",
          status: "active",
          account: { id: ACCOUNT_A },
        },
        {
          id: "z2",
          name: "other.dev",
          status: "active",
          account: { id: ACCOUNT_B },
        },
      ]);
    }) as typeof fetch;
    try {
      const cf = new CloudflareClient({
        accountId: ACCOUNT_A,
        apiToken: "tok",
      });
      const zones = await cf.listZones();
      assert.match(seen[0] ?? "", /account\.id=/);
      assert.deepEqual(
        zones.map((z) => z.name),
        ["relaybase.xyz"],
      );
      assert.equal(zones[0]?.accountId, ACCOUNT_A);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("returns every token-visible zone when no account is pinned", async () => {
    const seen: string[] = [];
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonOk([
        {
          id: "z1",
          name: "relaybase.xyz",
          status: "active",
          account: { id: ACCOUNT_A },
        },
        {
          id: "z2",
          name: "other.dev",
          status: "active",
          account: { id: ACCOUNT_B },
        },
      ]);
    }) as typeof fetch;
    try {
      const cf = new CloudflareClient({ apiToken: "tok" });
      const zones = await cf.listZones();
      assert.doesNotMatch(seen[0] ?? "", /account\.id=/);
      assert.equal(zones.length, 2);
      assert.equal(zones[1]?.accountId, ACCOUNT_B);
    } finally {
      globalThis.fetch = previous;
    }
  });
});

describe("CloudflareClient.resolveZoneId", () => {
  it("ignores a same-name zone on another account", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      assert.match(String(input), /account\.id=/);
      return jsonOk([
        {
          id: "wrong-zone",
          name: "other.dev",
          account: { id: ACCOUNT_B },
        },
      ]);
    }) as typeof fetch;
    try {
      const cf = new CloudflareClient({
        accountId: ACCOUNT_A,
        apiToken: "tok",
      });
      assert.equal(await cf.resolveZoneId("other.dev"), null);
    } finally {
      globalThis.fetch = previous;
    }
  });
});
