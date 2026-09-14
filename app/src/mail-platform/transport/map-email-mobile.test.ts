import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapEmailApiToMobile } from "./map-email-mobile.ts";

describe("mapEmailApiToMobile", () => {
  it("maps mail routes", () => {
    assert.equal(mapEmailApiToMobile("/api/email/inbox"), "/mobile/inbox");
    assert.equal(mapEmailApiToMobile("/api/email/send"), "/mobile/send");
    assert.equal(
      mapEmailApiToMobile("/api/email/addresses"),
      "/mobile/mailbox",
    );
  });

  it("maps account-state routes", () => {
    assert.equal(
      mapEmailApiToMobile("/api/email/account-state/ui/sidebar.json"),
      "/mobile/account-state/ui/sidebar.json",
    );
    assert.equal(
      mapEmailApiToMobile(
        "/api/email/account-state/drafts/d1/attachments/a1",
      ),
      "/mobile/account-state/drafts/d1/attachments/a1",
    );
  });

  it("does not map console-only routes", () => {
    assert.equal(mapEmailApiToMobile("/api/email/broadcast-drafts"), null);
    assert.equal(mapEmailApiToMobile("/api/email/settings"), null);
  });
});
