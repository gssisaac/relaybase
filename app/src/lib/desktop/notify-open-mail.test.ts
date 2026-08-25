import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inboxHrefForNotification } from "./notify-open-mail.ts";

describe("inboxHrefForNotification", () => {
  it("builds inbox selection from messageId and account", () => {
    assert.equal(
      inboxHrefForNotification({
        messageId: "msg_abc",
        account: "hello@example.com",
      }),
      "/email/inbox?account=hello%40example.com&m=msg_abc",
    );
  });

  it("omits account when missing or all", () => {
    assert.equal(
      inboxHrefForNotification({ messageId: "msg_1" }),
      "/email/inbox?m=msg_1",
    );
    assert.equal(
      inboxHrefForNotification({ messageId: "msg_1", account: "all" }),
      "/email/inbox?m=msg_1",
    );
    assert.equal(
      inboxHrefForNotification({ messageId: "msg_1", account: "  " }),
      "/email/inbox?m=msg_1",
    );
  });

  it("returns null without a message id", () => {
    assert.equal(inboxHrefForNotification({ account: "a@b.com" }), null);
    assert.equal(inboxHrefForNotification({ messageId: "  " }), null);
    assert.equal(inboxHrefForNotification({}), null);
  });
});
