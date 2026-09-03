import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isConsoleAuthMissingError,
  isConsoleUnlockRequiredError,
  isMailAuthMissingError,
  isMissingWorkerError,
  isMissingWorkerUnlockMessage,
  isWorkerAuthMissingError,
  isWorkerUnreachableError,
  missingWorkerHelp,
  missingWorkerSummary,
  visibleUnlockError,
} from "../errors.ts";

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
      isMissingWorkerError(new Error("Invalid credentials. Check the passtoken")),
      false,
    );
    assert.equal(isMissingWorkerError(new Error("Account not found")), false);
    assert.equal(isMissingWorkerError(new Error("Unauthorized")), false);
  });
});

describe("missingWorkerHelp", () => {
  it("tells owners to install without manual-install links", () => {
    const help = missingWorkerHelp("owner");
    assert.equal(help.title, "Worker not found");
    assert.match(help.fix, /Install Relaybase/i);
    assert.equal(help.links, undefined);
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
      "Passtoken didn't match this Worker. Check the token or use I forgot my passtoken.",
    );
  });

  it("maps stored keyring mismatch verbatim", () => {
    assert.equal(
      visibleUnlockError(
        new Error(
          "Stored passtoken didn't match this Worker. Paste your current passtoken.",
        ),
        "owner",
      ),
      "Stored passtoken didn't match this Worker. Paste your current passtoken.",
    );
  });
});

describe("isWorkerUnreachableError", () => {
  it("detects Worker-unreachable / offline transport errors", () => {
    assert.equal(
      isWorkerUnreachableError(
        new Error("Worker request failed: error sending request"),
      ),
      true,
    );
  });

  it("does not treat dismissed Touch ID or expired refresh as unreachable", () => {
    assert.equal(
      isWorkerUnreachableError(
        new Error("[UserCancel] - The user cancelled the authentication"),
      ),
      false,
    );
    assert.equal(
      isWorkerUnreachableError(
        new Error("Session expired. Sign in with your passtoken."),
      ),
      false,
    );
    assert.equal(
      isWorkerUnreachableError(
        new Error("Console session expired. Sign in with your passtoken."),
      ),
      false,
    );
    assert.equal(
      isWorkerUnreachableError(new Error("Unauthorized")),
      false,
    );
    assert.equal(
      isWorkerUnreachableError(new Error("Worker request failed (HTTP 401)")),
      false,
    );
    assert.equal(
      isWorkerUnreachableError(new Error("Worker request failed: Unauthorized")),
      false,
    );
    assert.equal(
      isWorkerUnreachableError(new Error("Not signed in")),
      false,
    );
  });
});

describe("isConsoleUnlockRequiredError", () => {
  it("detects the desktop no-console-session messages", () => {
    assert.equal(
      isConsoleUnlockRequiredError(
        new Error(
          "No saved console session. Unlock the dashboard with Touch ID or passtoken.",
        ),
      ),
      true,
    );
    assert.equal(
      isConsoleUnlockRequiredError(
        "Console session expired. Sign in with your passtoken.",
      ),
      true,
    );
    assert.equal(
      isConsoleUnlockRequiredError(new Error("Invalid credentials")),
      false,
    );
  });
});

describe("isConsoleAuthMissingError", () => {
  it("treats unsigned console-scope errors as needing the gate", () => {
    assert.equal(
      isConsoleAuthMissingError(new Error("Not signed in"), "/console/domains"),
      true,
    );
    assert.equal(
      isConsoleAuthMissingError(new Error("Not signed in"), "/mail/inbox"),
      false,
    );
  });
});

describe("isMailAuthMissingError", () => {
  it("treats mail-scope auth errors as needing mail re-auth", () => {
    assert.equal(
      isMailAuthMissingError(new Error("Not signed in"), "/mail/inbox"),
      true,
    );
    assert.equal(
      isMailAuthMissingError(new Error("Session expired. Sign in with your passtoken."), "/mail/inbox"),
      true,
    );
    assert.equal(
      isMailAuthMissingError(new Error("No saved mail session. Sign in with your passtoken."), "/mail/inbox"),
      true,
    );
    assert.equal(
      isMailAuthMissingError(new Error("Unauthorized"), "/mail/inbox"),
      true,
    );
    assert.equal(
      isMailAuthMissingError(new Error("Not signed in"), "/console/domains"),
      false,
    );
  });
});

describe("isWorkerAuthMissingError", () => {
  it("detects auth missing on either scope", () => {
    assert.equal(
      isWorkerAuthMissingError(new Error("Not signed in"), "/console/domains"),
      true,
    );
    assert.equal(
      isWorkerAuthMissingError(new Error("Not signed in"), "/mail/inbox"),
      true,
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
