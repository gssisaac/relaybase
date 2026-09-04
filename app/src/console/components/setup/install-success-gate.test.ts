import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canEnterMailboxAfterInstall,
  issuePasstokenWithRetry,
  mustIssuePasstokenOnSetupInstall,
  shouldAutoOpenEnableEmailApiAfterInstall,
} from "./install-success-gate.ts";

describe("mustIssuePasstokenOnSetupInstall", () => {
  it("always issues on Setup install, including overwrite of an existing owner", () => {
    assert.equal(
      mustIssuePasstokenOnSetupInstall({
        purpose: "install",
        ownerAlreadyConfigured: true,
      }),
      true,
    );
    assert.equal(
      mustIssuePasstokenOnSetupInstall({
        purpose: "install",
        ownerAlreadyConfigured: false,
      }),
      true,
    );
  });

  it("does not rotate passtoken on Settings Worker update", () => {
    assert.equal(
      mustIssuePasstokenOnSetupInstall({
        purpose: "worker-update",
        ownerAlreadyConfigured: true,
      }),
      false,
    );
  });
});

describe("canEnterMailboxAfterInstall", () => {
  it("stays locked when overwrite skipped passtoken issuance", () => {
    assert.equal(
      canEnterMailboxAfterInstall({
        revealedPasstoken: "",
        tokenSaved: false,
        needsOwnerSetup: false,
      }),
      false,
    );
  });

  it("stays locked after Enable email API skip when no passtoken was saved", () => {
    assert.equal(
      canEnterMailboxAfterInstall({
        revealedPasstoken: "",
        tokenSaved: false,
        needsOwnerSetup: false,
      }),
      false,
    );
  });

  it("stays locked until the issued passtoken is copied or downloaded", () => {
    assert.equal(
      canEnterMailboxAfterInstall({
        revealedPasstoken: "rb_pass_0123456789abcdef",
        tokenSaved: false,
        needsOwnerSetup: false,
      }),
      false,
    );
  });

  it("unlocks only after the issued passtoken is saved", () => {
    assert.equal(
      canEnterMailboxAfterInstall({
        revealedPasstoken: "rb_pass_0123456789abcdef",
        tokenSaved: true,
        needsOwnerSetup: false,
      }),
      true,
    );
  });

  it("stays locked while Issue passtoken is still required", () => {
    assert.equal(
      canEnterMailboxAfterInstall({
        revealedPasstoken: "rb_pass_0123456789abcdef",
        tokenSaved: true,
        needsOwnerSetup: true,
      }),
      false,
    );
  });
});

describe("shouldAutoOpenEnableEmailApiAfterInstall", () => {
  it("never auto-opens — Enable email API is button-only", () => {
    assert.equal(shouldAutoOpenEnableEmailApiAfterInstall(), false);
  });
});

describe("issuePasstokenWithRetry", () => {
  it("retries then returns the issued passtoken", async () => {
    let calls = 0;
    const issued = await issuePasstokenWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("Unauthorized");
        return { passtoken: "rb_pass_retry" };
      },
      { workerUrl: "https://example.workers.dev", pepper: "pepper" },
      { attempts: 3, delayMs: 1, sleep: async () => {} },
    );
    assert.equal(issued.passtoken, "rb_pass_retry");
    assert.equal(calls, 3);
  });

  it("rejects empty passtoken responses", async () => {
    await assert.rejects(
      issuePasstokenWithRetry(
        async () => ({ passtoken: "  " }),
        { workerUrl: "https://example.workers.dev", pepper: "pepper" },
        { attempts: 1, sleep: async () => {} },
      ),
      /did not return a passtoken/,
    );
  });
});
