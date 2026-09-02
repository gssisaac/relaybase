import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zonesOnConnectedAccount } from "./zones-on-connected-account.ts";

const ACCOUNT_A = "aa".repeat(16);
const ACCOUNT_B = "bb".repeat(16);

describe("zonesOnConnectedAccount", () => {
  const zones = [
    { id: "1", name: "wipibox.com", status: "active", accountId: ACCOUNT_A },
    { id: "2", name: "other.dev", status: "active", accountId: ACCOUNT_B },
  ];

  it("keeps only the connected Cloudflare account", () => {
    assert.deepEqual(zonesOnConnectedAccount(zones, ACCOUNT_A), [zones[0]]);
  });

  it("drops untagged zones instead of showing every account", () => {
    const untagged = [
      { id: "1", name: "wipibox.com", status: "active" },
      { id: "2", name: "other.dev", status: "active" },
    ];
    assert.deepEqual(zonesOnConnectedAccount(untagged, ACCOUNT_A), []);
  });

  it("returns nothing without a connected account id", () => {
    assert.deepEqual(zonesOnConnectedAccount(zones, ""), []);
  });

  it("does not keep another account's Worker-scoped list", () => {
    const onlyB = [zones[1]!];
    assert.deepEqual(zonesOnConnectedAccount(onlyB, ACCOUNT_A), []);
  });

  it("hides a mixed list that does not include the connected account", () => {
    assert.deepEqual(zonesOnConnectedAccount(zones, "cc".repeat(16)), []);
  });
});
