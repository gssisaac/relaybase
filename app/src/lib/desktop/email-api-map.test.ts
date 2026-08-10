import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapEmailApiToWorker } from "./email-api-map.ts";

describe("mapEmailApiToWorker", () => {
  it("maps inbox and mailbox routes", () => {
    assert.equal(
      mapEmailApiToWorker("/api/email/inbox?domain=a.com"),
      "/admin/inbox?domain=a.com",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/inbox/read"),
      "/admin/inbox/read",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/addresses?all=1"),
      "/admin/addresses?all=1",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/domains"),
      "/admin/domains",
    );
    assert.equal(mapEmailApiToWorker("/api/email/send"), "/admin/send");
    assert.equal(
      mapEmailApiToWorker("/api/email/config"),
      "/admin/mailbox/config",
    );
  });

  it("maps keys, audience, broadcasts, stats", () => {
    assert.equal(mapEmailApiToWorker("/api/email/keys"), "/admin/keys");
    assert.equal(
      mapEmailApiToWorker("/api/email/keys/abc/rotate"),
      "/admin/keys/abc/rotate",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/audience-groups"),
      "/admin/audience-groups",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/broadcasts/x/send"),
      "/admin/broadcasts/x/send",
    );
    assert.equal(mapEmailApiToWorker("/api/email/stats"), "/admin/stats");
    assert.equal(
      mapEmailApiToWorker("/api/email/account-stats?email=a@b.com"),
      "/admin/stats/account-stats?email=a@b.com",
    );
    assert.equal(mapEmailApiToWorker("/api/email/logs"), "/admin/ops-logs");
    assert.equal(
      mapEmailApiToWorker("/api/email/logs?domain=a.com"),
      "/admin/ops-logs?domain=a.com",
    );
  });

  it("handles sent and onboard specials", () => {
    assert.equal(mapEmailApiToWorker("/api/email/sent"), "empty-sent");
    assert.equal(
      mapEmailApiToWorker("/api/email/domains/onboard"),
      "/admin/domains",
    );
  });
});
