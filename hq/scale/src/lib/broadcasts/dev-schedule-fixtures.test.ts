import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Broadcast, ScaleDataStore } from "../../db/types.ts";
import { ensureDevScheduleFixtures } from "./dev-schedule-fixtures.ts";

function broadcast(id: string): Broadcast {
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
    defaultTemplateId: null,
    complianceIdentityId: null,
    listStatus: "active",
    subject: "Subject",
    previewText: null,
    bodyMarkdown: "Hi",
    templateId: null,
    templateVariables: {},
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
  it("schedules demo broadcasts and pending jobs", () => {
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
      broadcasts: [
        broadcast("broadcast_scheduled_ama"),
        broadcast("broadcast_sent_sep_digest"),
        broadcast("broadcast_6335f85b-01f5-4ccb-a2c7-37980c32f53c"),
      ],
      recipients: [],
      automations: [],
      triggerEvents: [],
      automationSends: [],
      automationTrackingEvents: [],
      accountSuppressions: [],
      pipelineCards: [],
      activities: [],
      templates: [],
      scheduledJobs: [],
      trackingEvents: [],
      broadcastAssets: [],
      automationAssets: [],
      audienceGroups: [],
    };

    const now = new Date("2026-09-15T12:00:00.000Z");
    const changed = ensureDevScheduleFixtures(store, now);
    assert.equal(changed, true);
    assert.equal(store.broadcasts.filter((b) => b.status === "scheduled").length, 3);
    assert.equal(store.scheduledJobs.filter((j) => j.status === "pending").length, 3);
    const ama = store.broadcasts.find((b) => b.id === "broadcast_scheduled_ama")!;
    assert.ok(ama.scheduledAt);
    assert.ok(new Date(ama.scheduledAt!).getTime() > now.getTime());
  });
});
