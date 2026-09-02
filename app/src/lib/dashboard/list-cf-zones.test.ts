import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zonesOnConnectedAccount } from "./zones-on-connected-account.ts";

const ACCOUNT_A = "aa".repeat(16);
const ACCOUNT_B = "bb".repeat(16);

describe("zonesOnConnectedAccount", () => {
  const zones = [
    { id: "1", name: "relaybase.xyz", status: "active", accountId: ACCOUNT_A },
    { id: "2", name: "other.dev", status: "active", accountId: ACCOUNT_B },
  ];

  it("drops zones from other Cloudflare accounts", () => {
    assert.deepEqual(zonesOnConnectedAccount(zones, ACCOUNT_A), [zones[0]]);
  });

  it("keeps the full list when the Worker omitted accountId", () => {
    const legacy = [
      { id: "1", name: "relaybase.xyz", status: "active" },
      { id: "2", name: "other.dev", status: "active" },
    ];
    assert.deepEqual(zonesOnConnectedAccount(legacy, ACCOUNT_A), legacy);
  });

  it("keeps the full list without a connected account id", () => {
    assert.equal(zonesOnConnectedAccount(zones, "").length, 2);
  });

  it("does not hide a Worker-scoped list from a different pin", () => {
    const onlyB = [zones[1]!];
    assert.deepEqual(zonesOnConnectedAccount(onlyB, ACCOUNT_A), onlyB);
  });

  it("hides a mixed list that does not include the connected account", () => {
    assert.deepEqual(zonesOnConnectedAccount(zones, "cc".repeat(16)), []);
  });
});
