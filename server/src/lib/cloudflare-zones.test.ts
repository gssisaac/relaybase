// @ts-ignore node:test types are not bundled under @cloudflare/workers-types
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  mapCfZoneRow,
  zoneBelongsToPinnedAccount,
  zonesListQuery,
  zonesOnPinnedAccount,
} from "./cloudflare-zones.ts";

const ACCOUNT_A = "3adf03d991843094a7343eebc0a98007";
const ACCOUNT_B = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("zonesOnPinnedAccount", () => {
  const zones = [
    { id: "z1", name: "relaybase.xyz", status: "active", accountId: ACCOUNT_A },
    { id: "z2", name: "other.dev", status: "active", accountId: ACCOUNT_B },
    { id: "z3", name: "also.xyz", status: "active", accountId: ACCOUNT_A },
  ];

  it("keeps every zone when no account is pinned", () => {
    assert.equal(zonesOnPinnedAccount(zones, "").length, 3);
    assert.equal(zonesOnPinnedAccount(zones, null).length, 3);
    assert.equal(zonesOnPinnedAccount(zones, "not-an-id").length, 3);
  });

  it("drops zones that belong to another Cloudflare account", () => {
    const kept = zonesOnPinnedAccount(zones, ACCOUNT_A);
    assert.deepEqual(
      kept.map((z) => z.name),
      ["relaybase.xyz", "also.xyz"],
    );
  });
});

describe("zoneBelongsToPinnedAccount", () => {
  it("accepts any zone when nothing is pinned", () => {
    assert.equal(zoneBelongsToPinnedAccount(ACCOUNT_B, ""), true);
  });

  it("rejects a zone on a different account", () => {
    assert.equal(zoneBelongsToPinnedAccount(ACCOUNT_B, ACCOUNT_A), false);
    assert.equal(zoneBelongsToPinnedAccount(ACCOUNT_A, ACCOUNT_A), true);
  });
});

describe("zonesListQuery", () => {
  it("omits account.id without a pin", () => {
    assert.equal(zonesListQuery(1), "per_page=50&page=1");
    assert.equal(zonesListQuery(2, ""), "per_page=50&page=2");
  });

  it("includes account.id when pinned", () => {
    assert.equal(
      zonesListQuery(1, ACCOUNT_A),
      `per_page=50&page=1&account.id=${ACCOUNT_A}`,
    );
  });
});

describe("mapCfZoneRow", () => {
  it("normalizes account.id", () => {
    assert.deepEqual(
      mapCfZoneRow({
        id: "z1",
        name: "Relaybase.xyz",
        status: "active",
        account: { id: ACCOUNT_A.toUpperCase() },
      }),
      {
        id: "z1",
        name: "Relaybase.xyz",
        status: "active",
        accountId: ACCOUNT_A,
      },
    );
  });
});
