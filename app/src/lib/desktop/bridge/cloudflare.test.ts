import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { displayCfAccountId, mailApiReady } from "./cloudflare.ts";

describe("mailApiReady", () => {
  it("is ready when the token is set and the probe is not false", () => {
    assert.equal(mailApiReady({ cfApiTokenSet: true }), true);
    assert.equal(
      mailApiReady({ cfApiTokenSet: true, cfApiTokenValid: true }),
      true,
    );
  });

  it("does not require Worker accountId", () => {
    assert.equal(
      mailApiReady({ cfApiTokenSet: true, cfApiTokenValid: true, accountId: "" }),
      true,
    );
  });

  it("fails when the token is missing or Cloudflare rejected it", () => {
    assert.equal(mailApiReady({}), false);
    assert.equal(mailApiReady({ cfApiTokenSet: false }), false);
    assert.equal(
      mailApiReady({ cfApiTokenSet: true, cfApiTokenValid: false }),
      false,
    );
  });
});

describe("displayCfAccountId", () => {
  it("prefers the Worker id, then credentials", () => {
    assert.equal(
      displayCfAccountId({
        workerAccountId: "aa".repeat(16),
        credentialsAccountId: "bb".repeat(16),
      }),
      "aa".repeat(16),
    );
    assert.equal(
      displayCfAccountId({
        workerAccountId: "  ",
        credentialsAccountId: "bb".repeat(16),
      }),
      "bb".repeat(16),
    );
    assert.equal(displayCfAccountId({}), "");
  });
});
