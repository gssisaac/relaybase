import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, validatePasswordPolicy, verifyPassword } from "@lib/auth/password";

describe("hq password", () => {
  it("hashes and verifies", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    assert.equal(verifyPassword("correct-horse-battery-staple", hash), true);
    assert.equal(verifyPassword("wrong", hash), false);
  });

  it("enforces minimum length", () => {
    assert.match(validatePasswordPolicy("short") ?? "", /10 characters/);
    assert.equal(validatePasswordPolicy("long-enough-pass"), null);
  });
});
