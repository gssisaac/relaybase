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

  it("treats /studio as studio mode", () => {
    assert.equal(modeFromPathname("/studio/subscribers"), "studio");
    assert.equal(modeFromPathname("/studio/newsletters"), "studio");
    assert.equal(modeFromPathname("/studio/settings"), "studio");
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

  it("rewrites subscriber and broadcast path details into ?id=&tab=", () => {
    assert.equal(
      normalizeEntryPath("/audience/grp1/settings"),
      "/studio/subscribers?id=grp1&tab=settings",
    );
    assert.equal(
      normalizeEntryPath("/broadcasts/bc1/progress"),
      "/studio/newsletters?id=bc1&tab=stats",
    );
    assert.equal(normalizeEntryPath("/broadcasts/new"), "/studio/newsletters?new=1");
    assert.equal(
      normalizeEntryPath("/studio/layouts?id=custom-1"),
      "/studio/settings/layouts?id=custom-1",
    );
  });

  it("rewrites automation nested tabs into ?id=&tab= for last-path restore", () => {
    assert.equal(
      normalizeEntryPath("/studio/triggers/automation_abc/settings"),
      "/studio/triggers?id=automation_abc&tab=config",
    );
    assert.equal(
      normalizeEntryPath("/studio/triggers/automation_abc/preview"),
      "/studio/triggers?id=automation_abc&tab=config",
    );
    assert.equal(
      normalizeEntryPath("/studio/triggers/automation_abc/config"),
      "/studio/triggers?id=automation_abc&tab=config",
    );
    assert.equal(
      normalizeEntryPath("/studio/triggers/automation_abc/edit"),
      "/studio/triggers/edit?id=automation_abc",
    );
  });

  it("rewrites legacy /studio/broadcasts paths to /studio/newsletters", () => {
    assert.equal(normalizeEntryPath("/studio/broadcasts/sent"), "/studio/newsletters/sent");
    assert.equal(normalizeEntryPath("/studio/automations/edit"), "/studio/triggers/edit");
  });

  it("keeps newsletter section sub-routes for sidebar highlighting", () => {
    assert.equal(
      normalizeEntryPath("/studio/newsletters/sent"),
      "/studio/newsletters/sent",
    );
    assert.equal(
      normalizeEntryPath("/studio/newsletters/in-progress"),
      "/studio/newsletters/in-progress",
    );
    assert.equal(
      normalizeEntryPath("/broadcasts/sent"),
      "/studio/newsletters/sent",
    );
    assert.equal(
      normalizeEntryPath("/studio/newsletters/broadcast_abc/stats"),
      "/studio/newsletters?id=broadcast_abc&tab=stats",
    );
  });

  it("keeps /settings/{tab} as nested routes", () => {
    assert.equal(normalizeEntryPath("/settings"), "/settings");
    assert.equal(normalizeEntryPath("/settings/"), "/settings");
    assert.equal(
      normalizeEntryPath("/settings/worker"),
      "/settings/worker",
    );
    assert.equal(
      normalizeEntryPath("/settings/mailbox"),
      "/settings/mailbox",
    );
    assert.equal(
      normalizeEntryPath("/settings/update"),
      "/settings/update",
    );
    assert.equal(
      normalizeEntryPath("/settings/cloudflare"),
      "/settings",
    );
  });

  it("rewrites legacy /settings?tab= into nested routes", () => {
    assert.equal(
      normalizeEntryPath("/settings?tab=d1"),
      "/settings/d1",
    );
    assert.equal(
      normalizeEntryPath("/settings?tab=cloudflare"),
      "/settings",
    );
  });

  it("rewrites removed admin-token settings onto Worker", () => {
    assert.equal(
      normalizeEntryPath("/settings/admin-token"),
      "/settings/worker",
    );
    assert.equal(
      normalizeEntryPath("/settings?tab=admin-token"),
      "/settings/worker",
    );
  });
});

describe("app entry path policy", () => {
  it("defaults the email entry to /email/inbox", () => {
    assert.equal(DEFAULT_EMAIL_PATH, "/email/inbox");
    assert.equal(isRestorablePath(DEFAULT_EMAIL_PATH, "email"), true);
    assert.equal(isRestorablePath(DEFAULT_DASHBOARD_PATH, "email"), false);
  });
});
