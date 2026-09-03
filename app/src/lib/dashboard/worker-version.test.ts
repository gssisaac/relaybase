import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { desktopBehindRelease, workerNeedsUpgrade } from "./worker-version.ts";

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

  it("does not offer worker above desktop version", () => {
    assert.equal(workerNeedsUpgrade("0.1.1", "0.1.2", "0.1.1"), false);
    assert.equal(workerNeedsUpgrade("unknown", "0.1.2", "0.1.1"), false);
  });

  it("offers worker behind desktop when manifest matches desktop", () => {
    assert.equal(workerNeedsUpgrade("0.1.0", "0.1.1", "0.1.1"), true);
    assert.equal(workerNeedsUpgrade("unknown", "0.1.1", "0.1.1"), true);
  });
});

describe("desktopBehindRelease", () => {
  it("is true when desktop is older than latest", () => {
    assert.equal(desktopBehindRelease("0.1.1", "0.1.2"), true);
  });

  it("is false when desktop matches or exceeds latest", () => {
    assert.equal(desktopBehindRelease("0.1.2", "0.1.2"), false);
    assert.equal(desktopBehindRelease("0.1.3", "0.1.2"), false);
  });
});
