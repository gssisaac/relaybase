import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapEmailApiToWorker } from "./email-api-map.ts";

describe("mapEmailApiToWorker", () => {
  it("maps inbox and mailbox routes", () => {
    assert.equal(
      mapEmailApiToWorker("/api/email/inbox?domain=a.com"),
      "/mail/inbox?domain=a.com",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/inbox/read"),
      "/mail/inbox/read",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/addresses?all=1"),
      "/console/addresses?all=1",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/domains"),
      "/console/domains",
    );
    assert.equal(mapEmailApiToWorker("/api/email/send"), "/mail/send");
    assert.equal(
      mapEmailApiToWorker("/api/email/config"),
      "/console/mailbox/config",
    );
  });

  it("maps keys, audience, broadcasts, stats", () => {
    assert.equal(mapEmailApiToWorker("/api/email/keys"), "/console/keys");
    assert.equal(
      mapEmailApiToWorker("/api/email/keys/abc/rotate"),
      "/console/keys/abc/rotate",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/audience-groups"),
      "/console/audience-groups",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/broadcasts/x/send"),
      "/console/broadcasts/x/send",
    );
    assert.equal(mapEmailApiToWorker("/api/email/stats"), "/console/stats");
    assert.equal(
      mapEmailApiToWorker("/api/email/account-stats?email=a@b.com"),
      "/console/stats/account-stats?email=a@b.com",
    );
    assert.equal(mapEmailApiToWorker("/api/email/logs"), "/console/ops-logs");
    assert.equal(
      mapEmailApiToWorker("/api/email/logs?domain=a.com"),
      "/console/ops-logs?domain=a.com",
    );
  });

  it("handles sent and onboard specials", () => {
    assert.equal(mapEmailApiToWorker("/api/email/sent"), "/mail/sent");
    assert.equal(
      mapEmailApiToWorker("/api/email/domains/onboard"),
      "/console/domains",
    );
  });

  it("maps mobile-password", () => {
    assert.equal(
      mapEmailApiToWorker("/api/email/mobile-password"),
      "/console/addresses/mobile-password",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/mobile-password?email=a@b.com"),
      "/console/addresses/mobile-password?email=a@b.com",
    );
  });
});
