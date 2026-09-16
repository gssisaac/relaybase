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
      "/mail/addresses",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/addresses?domain=a.com"),
      "/console/addresses?domain=a.com",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/domains"),
      "/console/domains",
    );
    assert.equal(mapEmailApiToWorker("/api/email/zones"), "/console/zones");
    assert.equal(
      mapEmailApiToWorker(
        "/api/email/zones?accountId=674a35f00d9800eec7d6bc42fe55726e",
      ),
      "/console/zones?accountId=674a35f00d9800eec7d6bc42fe55726e",
    );
    assert.equal(mapEmailApiToWorker("/api/email/send"), "/mail/send");
    assert.equal(
      mapEmailApiToWorker("/api/email/sending-health"),
      "/mail/sending-health",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/sending-onboard"),
      "/console/sending-onboard",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/email-routing/addresses"),
      "/console/email-routing/addresses",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/email-routing/addresses/abc123"),
      "/console/email-routing/addresses/abc123",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/config"),
      "/console/mailbox/config",
    );
  });

  it("maps keys, stats; Scale owns audience/broadcasts", () => {
    assert.equal(mapEmailApiToWorker("/api/email/keys"), "/console/keys");
    assert.equal(
      mapEmailApiToWorker("/api/email/keys/abc/rotate"),
      "/console/keys/abc/rotate",
    );
    assert.equal(mapEmailApiToWorker("/api/email/audience-groups"), null);
    assert.equal(mapEmailApiToWorker("/api/email/broadcasts/x/send"), null);
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
    assert.equal(
      mapEmailApiToWorker("/api/email/settings"),
      "/console/settings",
    );
  });

  it("handles sent and onboard specials", () => {
    assert.equal(mapEmailApiToWorker("/api/email/sent"), "/mail/sent");
    assert.equal(
      mapEmailApiToWorker("/api/email/sent?domain=a.com"),
      "/mail/sent?domain=a.com",
    );
    assert.equal(
      mapEmailApiToWorker("/api/email/sent/abc123?domain=a.com"),
      "/mail/sent/abc123?domain=a.com",
    );
    assert.equal(
      mapEmailApiToWorker(
        "/api/email/sent/abc123/attachments/0?domain=a.com",
      ),
      "/mail/sent/abc123/attachments/0?domain=a.com",
    );
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

  it("maps account-state and broadcast-drafts", () => {
    assert.equal(
      mapEmailApiToWorker("/api/email/account-state/ui/sidebar.json"),
      "/mail/account-state/ui/sidebar.json",
    );
    assert.equal(
      mapEmailApiToWorker(
        "/api/email/account-state/drafts/d1/attachments/a1",
      ),
      "/mail/account-state/drafts/d1/attachments/a1",
    );
    assert.equal(mapEmailApiToWorker("/api/email/broadcast-drafts"), null);
  });
});
