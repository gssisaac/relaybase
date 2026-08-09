import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  isRestorablePath,
  modeFromPathname,
} from "./sidebar-mode.ts";

describe("modeFromPathname", () => {
  it("treats /email as email mode", () => {
    assert.equal(modeFromPathname("/email"), "email");
    assert.equal(modeFromPathname("/email/inbox"), "email");
  });

  it("treats everything else as dashboard", () => {
    assert.equal(modeFromPathname("/dashboard"), "dashboard");
    assert.equal(modeFromPathname("/accounts"), "dashboard");
  });
});

describe("isRestorablePath", () => {
  it("accepts email paths only in email mode", () => {
    assert.equal(isRestorablePath("/email/inbox", "email"), true);
    assert.equal(isRestorablePath("/email/inbox?account=a@b.com", "email"), true);
    assert.equal(isRestorablePath("/dashboard", "email"), false);
  });

  it("accepts non-email paths in dashboard mode", () => {
    assert.equal(isRestorablePath("/dashboard", "dashboard"), true);
    assert.equal(isRestorablePath("/domains?domain=x.com", "dashboard"), true);
    assert.equal(isRestorablePath("/email/inbox", "dashboard"), false);
  });

  it("rejects auth/setup/api and root", () => {
    assert.equal(isRestorablePath("/", "dashboard"), false);
    assert.equal(isRestorablePath("/login", "dashboard"), false);
    assert.equal(isRestorablePath("/setup/install", "dashboard"), false);
    assert.equal(isRestorablePath("/api/auth", "dashboard"), false);
  });

  it("defaults are restorable", () => {
    assert.equal(isRestorablePath(DEFAULT_EMAIL_PATH, "email"), true);
    assert.equal(isRestorablePath(DEFAULT_DASHBOARD_PATH, "dashboard"), true);
  });
});
