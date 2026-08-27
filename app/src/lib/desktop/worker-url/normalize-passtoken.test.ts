import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isValidPasstokenFormat,
  normalizePasstokenInput,
} from "./normalize-passtoken.ts";

describe("normalizePasstokenInput", () => {
  it("passes through a raw rb_pass token", () => {
    const token = "rb_pass_abc123XYZ-_";
    assert.equal(normalizePasstokenInput(token), token);
    assert.equal(isValidPasstokenFormat(token), true);
  });

  it("strips PASSTOKEN= from download file lines", () => {
    const raw = "PASSTOKEN=rb_pass_abc123XYZ-_";
    assert.equal(normalizePasstokenInput(raw), "rb_pass_abc123XYZ-_");
    assert.equal(isValidPasstokenFormat(raw), true);
  });

  it("strips surrounding quotes and whitespace", () => {
    assert.equal(
      normalizePasstokenInput('  "rb_pass_abc123XYZ-_"  '),
      "rb_pass_abc123XYZ-_",
    );
  });

  it("rejects admin-token shaped values", () => {
    assert.equal(isValidPasstokenFormat("rb-auth-legacy-token"), false);
  });
});
