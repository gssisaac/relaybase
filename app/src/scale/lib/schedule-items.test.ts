import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Newsletter } from "../../lib/scale/api.ts";
import { upcomingNewsletterScheduleItems } from "./schedule-items.ts";

function newsletterRow(partial: Partial<Newsletter>): Newsletter {
  return {
    id: "b1",
    name: "Launch",
    slug: "launch",
    description: null,
    audienceGroupId: null,
    audienceGroupName: "Newsletter",
    audienceGroupDomain: null,
    domain: null,
    audienceContactCount: null,
    fromName: null,
    fromEmail: null,
    replyTo: null,
    defaultTemplateId: null,
    complianceIdentityId: null,
    listStatus: "active",
    subject: "Hello",
    previewText: null,
    bodyMarkdown: "",
    templateId: null,
    templateVariables: {},
    status: "scheduled",
    scheduledAt: "2030-06-15T14:00:00.000Z",
    sentAt: null,
    startedAt: null,
    finishedAt: null,
    stats: {
      sent: 0,
      delivered: 0,
      bounced: 0,
      failed: 0,
      skipped: 0,
      complained: 0,
      opened: 0,
      totalOpens: 0,
      clicked: 0,
      totalClicks: 0,
      unsubscribed: 0,
    },
    audienceActiveCount: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("upcomingNewsletterScheduleItems", () => {
  it("returns scheduled newsletters with future runAt, sorted", () => {
    const now = new Date("2030-06-01T00:00:00.000Z");
    const items = upcomingNewsletterScheduleItems(
      [
        newsletterRow({
          id: "later",
          scheduledAt: "2030-06-20T10:00:00.000Z",
        }),
        newsletterRow({
          id: "sooner",
          scheduledAt: "2030-06-10T10:00:00.000Z",
        }),
        newsletterRow({ id: "draft", status: "draft", scheduledAt: null }),
        newsletterRow({
          id: "past",
          scheduledAt: "2020-01-01T10:00:00.000Z",
        }),
      ],
      now,
    );
    assert.deepEqual(
      items.map((i) => i.newsletterId),
      ["sooner", "later"],
    );
    assert.equal(items[0]?.kind, "newsletter");
    assert.equal(items[0]?.id, "newsletter:sooner");
  });
});
