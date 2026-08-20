import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/types.ts";
import {
  collapseDuplicateInbound,
  filterSentForAccount,
  groupConversations,
  inboundMatchesAccount,
  normalizeMessageId,
  parseReferences,
  sentIsMeForAccount,
} from "./conversation-threading.ts";

function inbound(
  partial: Partial<RoutingActivityEvent> & Pick<RoutingActivityEvent, "key">,
): RoutingActivityEvent {
  return {
    fromEmail: "a@example.com",
    toEmail: "me@relay.test",
    subject: "Hello",
    status: "received",
    receivedAt: "2026-08-09T01:00:00.000Z",
    ...partial,
  };
}

describe("normalizeMessageId / parseReferences", () => {
  it("normalizes wrapped Message-IDs", () => {
    assert.equal(normalizeMessageId("<AbC@Host>"), "abc@host");
    assert.equal(normalizeMessageId("abc@host"), "abc@host");
  });

  it("parses References tokens", () => {
    assert.deepEqual(parseReferences("<one@x> <two@x>"), ["one@x", "two@x"]);
  });
});

describe("groupConversations", () => {
  it("groups inbound replies via In-Reply-To / References", () => {
    const root = inbound({
      key: "k1",
      messageId: "<root@mail>",
      receivedAt: "2026-08-09T01:00:00.000Z",
      subject: "Thread",
      bodyPreview: "first",
    });
    const reply = inbound({
      key: "k2",
      messageId: "<reply@mail>",
      inReplyTo: "<root@mail>",
      references: "<root@mail>",
      receivedAt: "2026-08-09T02:00:00.000Z",
      subject: "Re: Thread",
      bodyPreview: "second",
      fromEmail: "b@example.com",
    });
    const threads = groupConversations([root, reply], []);
    assert.equal(threads.length, 1);
    assert.equal(threads[0]!.messageCount, 2);
    assert.equal(threads[0]!.latestInboundKey, "k2");
    assert.deepEqual(threads[0]!.inboundKeys, ["k1", "k2"]);
  });

  it("includes sent replies linked by replyKey / In-Reply-To", () => {
    const root = inbound({
      key: "k1",
      messageId: "<root@mail>",
      receivedAt: "2026-08-09T01:00:00.000Z",
    });
    const sent: SentEmail = {
      id: "s1",
      from: "me@relay.test",
      to: "a@example.com",
      subject: "Re: Hello",
      bodyPreview: "my reply",
      sentAt: "2026-08-09T01:30:00.000Z",
      messageId: "<sent@mail>",
      inReplyTo: "<root@mail>",
      references: "<root@mail>",
      replyKey: "k1",
    };
    const threads = groupConversations([root], [sent]);
    assert.equal(threads.length, 1);
    assert.equal(threads[0]!.messageCount, 2);
    assert.equal(threads[0]!.messages[1]!.kind, "sent");
  });

  it("keeps unrelated messages as separate threads", () => {
    const a = inbound({ key: "a", messageId: "<a@x>" });
    const b = inbound({ key: "b", messageId: "<b@x>" });
    const threads = groupConversations([a, b], []);
    assert.equal(threads.length, 2);
  });

  it("collapses To+Cc routing copies that share a Message-ID", () => {
    const toCopy = inbound({
      key: "to-copy",
      messageId: "<same@mail>",
      toEmail: "support@kloyapp.com",
      toEmails: ["support@kloyapp.com"],
      ccEmails: ["isaac@kloyapp.com"],
      bodyPreview: "preview",
      receivedAt: "2026-08-10T02:38:00.000Z",
    });
    const ccCopy = inbound({
      key: "cc-copy",
      messageId: "<same@mail>",
      toEmail: "isaac@kloyapp.com",
      toEmails: ["support@kloyapp.com"],
      ccEmails: ["isaac@kloyapp.com"],
      bodyText: "full body",
      bodyPreview: "preview",
      receivedAt: "2026-08-10T02:38:00.000Z",
    });
    const collapsed = collapseDuplicateInbound([toCopy, ccCopy]);
    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0]!.key, "cc-copy");

    const threads = groupConversations([toCopy, ccCopy], []);
    assert.equal(threads.length, 1);
    assert.equal(threads[0]!.messageCount, 1);
    assert.equal(threads[0]!.inboundKeys.length, 1);
  });
});

describe("inboundMatchesAccount", () => {
  it("matches MIME Cc as well as envelope To", () => {
    const msg = inbound({
      key: "k",
      toEmail: "support@kloyapp.com",
      toEmails: ["support@kloyapp.com"],
      ccEmails: ["isaac@kloyapp.com"],
    });
    assert.equal(inboundMatchesAccount(msg, "support@kloyapp.com"), true);
    assert.equal(inboundMatchesAccount(msg, "isaac@kloyapp.com"), true);
    assert.equal(inboundMatchesAccount(msg, "other@kloyapp.com"), false);
  });
});

describe("filterSentForAccount / sentIsMeForAccount", () => {
  it("keeps only the filtered account's outbound mail", () => {
    const sent: SentEmail[] = [
      {
        id: "s1",
        from: "isaac@kloyapp.com",
        to: "tozer@example.com",
        subject: "Re: Q",
        bodyPreview: "from isaac",
        sentAt: "2026-08-10T02:41:00.000Z",
      },
      {
        id: "s2",
        from: "support@kloyapp.com",
        to: "tozer@example.com",
        subject: "Re: Q",
        bodyPreview: "from support",
        sentAt: "2026-08-10T02:48:00.000Z",
      },
    ];
    assert.deepEqual(
      filterSentForAccount(sent, "support@kloyapp.com").map((m) => m.id),
      ["s2"],
    );
    assert.equal(filterSentForAccount(sent, "all").length, 2);
    assert.equal(sentIsMeForAccount("isaac@kloyapp.com", "support@kloyapp.com"), false);
    assert.equal(sentIsMeForAccount("support@kloyapp.com", "support@kloyapp.com"), true);
    assert.equal(sentIsMeForAccount("isaac@kloyapp.com", "all"), true);
  });
});
