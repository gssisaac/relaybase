import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMissingWorkerError,
  isMissingWorkerUnlockMessage,
  isStayOnMailConsoleUnlockError,
  missingWorkerHelp,
  missingWorkerSummary,
  visibleUnlockError,
} from "./errors.ts";

describe("isMissingWorkerError", () => {
  it("detects Hono notFound and HTTP 404 login failures", () => {
    assert.equal(isMissingWorkerError(new Error("Not found")), true);
    assert.equal(isMissingWorkerError("not found"), true);
    assert.equal(
      isMissingWorkerError(new Error("Worker login failed (HTTP 404)")),
      true,
    );
    assert.equal(isMissingWorkerError(new Error("Login failed (HTTP 404)")), true);
  });

  it("ignores unrelated auth and resource errors", () => {
    assert.equal(
      isMissingWorkerError(new Error("Invalid credentials. Check username and passtoken")),
      false,
    );
    assert.equal(isMissingWorkerError(new Error("Account not found")), false);
    assert.equal(isMissingWorkerError(new Error("Unauthorized")), false);
  });
});

describe("missingWorkerHelp", () => {
  it("tells owners to install and links to setup", () => {
    const help = missingWorkerHelp("owner");
    assert.equal(help.title, "Worker not found");
    assert.match(help.fix, /Install Relaybase/i);
    assert.equal(help.links?.[0]?.href, "/setup/install");
  });

  it("tells invited teammates to contact the owner without install links", () => {
    const help = missingWorkerHelp("invited");
    assert.equal(help.title, "Could not reach the server");
    assert.match(help.fix, /owner/i);
    assert.equal(help.links, undefined);
  });
});

describe("visibleUnlockError", () => {
  it("returns role-specific summaries for missing Worker errors", () => {
    const err = new Error("Not found");
    assert.equal(
      visibleUnlockError(err, "owner"),
      missingWorkerSummary("owner"),
    );
    assert.equal(
      visibleUnlockError(err, "invited"),
      missingWorkerSummary("invited"),
    );
  });

  it("passes through other errors unchanged", () => {
    assert.equal(
      visibleUnlockError(new Error("Invalid credentials"), "owner"),
      "Invalid credentials",
    );
  });
});

describe("isStayOnMailConsoleUnlockError", () => {
  it("treats dismissed Touch ID and Worker-unreachable as stay-on-mail", () => {
    assert.equal(
      isStayOnMailConsoleUnlockError(
        new Error("[UserCancel] - The user cancelled the authentication"),
      ),
      true,
    );
    assert.equal(
      isStayOnMailConsoleUnlockError(
        new Error("Worker request failed: error sending request"),
      ),
      true,
    );
  });

  it("does not treat expired console refresh as stay-on-mail", () => {
    assert.equal(
      isStayOnMailConsoleUnlockError(
        new Error("Session expired. Sign in with your passtoken."),
      ),
      false,
    );
    assert.equal(
      isStayOnMailConsoleUnlockError(
        new Error("Console session expired. Sign in with your passtoken."),
      ),
      false,
    );
  });
});

describe("isMissingWorkerUnlockMessage", () => {
  it("matches stored unlock summaries by role", () => {
    assert.equal(
      isMissingWorkerUnlockMessage(missingWorkerSummary("owner"), "owner"),
      true,
    );
    assert.equal(
      isMissingWorkerUnlockMessage(missingWorkerSummary("invited"), "invited"),
      true,
    );
    assert.equal(
      isMissingWorkerUnlockMessage("Invalid credentials", "owner"),
      false,
    );
  });
});
