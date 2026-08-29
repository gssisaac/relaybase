import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { workerNeedsUpgrade } from "./worker-version.ts";

describe("workerNeedsUpgrade", () => {
  it("is false when latest is missing", () => {
    assert.equal(workerNeedsUpgrade("1.2.3", ""), false);
    assert.equal(workerNeedsUpgrade("1.2.3", null), false);
  });

  it("is true when current is missing or unknown", () => {
    assert.equal(workerNeedsUpgrade("", "1.4.0"), true);
    assert.equal(workerNeedsUpgrade(null, "1.4.0"), true);
    assert.equal(workerNeedsUpgrade("unknown", "1.4.0"), true);
  });

  it("is true when versions differ", () => {
    assert.equal(workerNeedsUpgrade("1.2.3", "1.4.0"), true);
  });

  it("is false when versions match", () => {
    assert.equal(workerNeedsUpgrade("1.4.0", "1.4.0"), false);
    assert.equal(workerNeedsUpgrade(" 1.4.0 ", "1.4.0"), false);
  });
});
