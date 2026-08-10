import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  isRestorablePath,
  modeFromPathname,
  normalizeEntryPath,
} from "./sidebar-paths.ts";

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

describe("normalizeEntryPath", () => {
  it("moves email message path segments into ?m=", () => {
    assert.equal(
      normalizeEntryPath("/email/inbox/msg%2F1?account=a%40b.com"),
      "/email/inbox?account=a%40b.com&m=msg%2F1",
    );
  });

  it("rewrites account detail paths into ?email=&tab=", () => {
    assert.equal(
      normalizeEntryPath("/accounts/a%40b.com/logs"),
      "/accounts?email=a%40b.com&tab=logs",
    );
    assert.equal(
      normalizeEntryPath("/accounts/a@b.com"),
      "/accounts?email=a%40b.com",
    );
  });

  it("keeps already query-style deep links", () => {
    assert.equal(
      normalizeEntryPath("/email/inbox?m=abc&account=a@b.com"),
      "/email/inbox?m=abc&account=a%40b.com",
    );
  });

  it("rewrites audience and broadcast path details into ?id=&tab=", () => {
    assert.equal(
      normalizeEntryPath("/audience/grp1/settings"),
      "/audience?id=grp1&tab=settings",
    );
    assert.equal(
      normalizeEntryPath("/broadcasts/bc1/progress"),
      "/broadcasts?id=bc1&tab=progress",
    );
    assert.equal(normalizeEntryPath("/broadcasts/new"), "/broadcasts?new=1");
  });
});
