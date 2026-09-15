import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Campaign, ScaleDataStore, Template } from "../../db/types.ts";
import { ensureDevScheduleFixtures } from "./dev-schedule-fixtures.ts";

function messageTemplate(campaignId: string): Template {
  return {
    id: `msgtpl_${campaignId}`,
    accountLinkId: "dev",
    name: campaignId,
    subject: "Subject",
    previewText: null,
    bodyMarkdown: "Hi",
    layoutId: "tpl-minimal",
    templateVariables: {},
    category: "marketing",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function campaign(id: string): Campaign {
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
    templateId: `msgtpl_${id}`,
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
  it("schedules demo campaigns and pending jobs", () => {
    const campaignIds = [
      "broadcast_scheduled_ama",
      "broadcast_sent_sep_digest",
      "broadcast_6335f85b-01f5-4ccb-a2c7-37980c32f53c",
    ];
    const store: ScaleDataStore = {
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
      templates: campaignIds.map(messageTemplate),
      campaigns: campaignIds.map(campaign),
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
      campaignAssets: [],
      triggerAssets: [],
      audienceGroups: [],
    };

    const now = new Date("2026-09-15T12:00:00.000Z");
    const changed = ensureDevScheduleFixtures(store, now);
    assert.equal(changed, true);
    assert.equal(store.campaigns[0]?.status, "scheduled");
    assert.ok(store.scheduledJobs.some((j) => j.kind === "campaign" && j.status === "pending"));
  });
});
