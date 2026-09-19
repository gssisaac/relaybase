import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeEnabledMailAccounts } from "./enabled-accounts.ts";

describe("mergeEnabledMailAccounts", () => {
  it("dedupes and appends new addresses", () => {
    assert.deepEqual(
      mergeEnabledMailAccounts(["team@example.com"], ["hello@example.com", "team@example.com"]),
      ["team@example.com", "hello@example.com"],
    );
  });

  it("trims whitespace", () => {
    assert.deepEqual(mergeEnabledMailAccounts([], ["  team@example.com  "]), [
      "team@example.com",
    ]);
  });
});
