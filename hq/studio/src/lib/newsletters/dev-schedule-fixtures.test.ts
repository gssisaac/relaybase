import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Message, Newsletter, StudioDataStore } from "../../db/types.ts";
import { ensureDevScheduleFixtures } from "./dev-schedule-fixtures.ts";

function messageForNewsletter(newsletterId: string): Message {
  return {
    id: `msgtpl_${newsletterId}`,
    accountLinkId: "dev",
    name: newsletterId,
    subject: "Subject",
    previewText: null,
    bodyMarkdown: "Hi",
    layoutId: "tpl-minimal",
    templateVariables: {},
    forkedFromTemplateId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function newsletter(id: string): Newsletter {
  return {
    id,
    accountLinkId: "dev",
    name: id,
    slug: id,
    description: null,
    audienceGroupId: "audience_x",
    domain: "relaybase.xyz",
    fromName: null,
    fromEmail: "a@relaybase.xyz",
    replyTo: null,
    messageId: `msgtpl_${id}`,
    complianceIdentityId: null,
    listStatus: "active",
    status: "draft",
    scheduledAt: null,
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("ensureDevScheduleFixtures", () => {
  it("schedules demo newsletters and pending jobs", () => {
    const newsletterIds = [
      "broadcast_scheduled_ama",
      "broadcast_sent_sep_digest",
      "broadcast_6335f85b-01f5-4ccb-a2c7-37980c32f53c",
    ];
    const store: StudioDataStore = {
      account: {
        id: "dev",
        workerUrl: null,
        domain: null,
        compliance: {
          organizationName: null,
          postalAddress: null,
          contactEmail: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        defaultComplianceIdentityId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      complianceIdentities: [],
      layouts: [],
      templates: [],
      messages: newsletterIds.map(messageForNewsletter),
      newsletters: newsletterIds.map(newsletter),
      recipients: [],
      triggers: [],
      triggerEvents: [],
      triggerSends: [],
      triggerTrackingEvents: [],
      accountSuppressions: [],
      pipelineCards: [],
      activities: [],
      scheduledJobs: [],
      trackingEvents: [],
      newsletterAssets: [],
      triggerAssets: [],
      audienceGroups: [],
    };

    const now = new Date("2026-09-15T12:00:00.000Z");
    const changed = ensureDevScheduleFixtures(store, now);
    assert.equal(changed, true);
    assert.equal(store.newsletters[0]?.status, "scheduled");
    assert.ok(store.scheduledJobs.some((j) => j.kind === "newsletter" && j.status === "pending"));
  });
});
