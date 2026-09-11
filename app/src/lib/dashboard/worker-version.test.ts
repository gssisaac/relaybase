import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  desktopBehindRelease,
  teamDesktopBehindWorker,
  teamDesktopUpdateAllowed,
  workerNeedsUpgrade,
} from "./worker-version.ts";

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

describe("teamDesktopUpdateAllowed", () => {
  it("fails open when the Worker has not reported a ceiling", () => {
    assert.equal(teamDesktopUpdateAllowed("0.1.9", ""), true);
    assert.equal(teamDesktopUpdateAllowed("0.1.9", null), true);
    assert.equal(teamDesktopUpdateAllowed("0.1.9", "unknown"), true);
  });

  it("fails open when the candidate version is unknown", () => {
    assert.equal(teamDesktopUpdateAllowed("", "0.1.8"), true);
    assert.equal(teamDesktopUpdateAllowed(null, "0.1.8"), true);
  });

  it("allows a candidate at or below the Worker's ceiling", () => {
    assert.equal(teamDesktopUpdateAllowed("0.1.8", "0.1.8"), true);
    assert.equal(teamDesktopUpdateAllowed("0.1.7", "0.1.8"), true);
    assert.equal(teamDesktopUpdateAllowed(" 0.1.8 ", "0.1.8"), true);
  });

  it("blocks a candidate ahead of the Worker's ceiling", () => {
    assert.equal(teamDesktopUpdateAllowed("0.1.9", "0.1.8"), false);
    assert.equal(teamDesktopUpdateAllowed("0.2.0", "0.1.8"), false);
  });
});

describe("teamDesktopBehindWorker", () => {
  it("is false when either side is missing or unknown", () => {
    assert.equal(teamDesktopBehindWorker("", "0.1.8"), false);
    assert.equal(teamDesktopBehindWorker("0.1.7", ""), false);
    assert.equal(teamDesktopBehindWorker("0.1.7", "unknown"), false);
    assert.equal(teamDesktopBehindWorker(null, null), false);
  });

  it("is true when the local app is behind the Worker's ceiling", () => {
    assert.equal(teamDesktopBehindWorker("0.1.7", "0.1.8"), true);
  });

  it("is false when the local app matches or exceeds the Worker's ceiling", () => {
    assert.equal(teamDesktopBehindWorker("0.1.8", "0.1.8"), false);
    assert.equal(teamDesktopBehindWorker("0.1.9", "0.1.8"), false);
  });
});
