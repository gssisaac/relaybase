import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Subscriber } from "../db/types";
import {
  findAudienceGroup,
  syncCampaignSubscribersFromAudienceGroup,
} from "../lib/audience-subscribers";

export const crmSubscribers = new Hono();

function findCampaign(campaignId: string) {
  return store.read().campaigns.find((c) => c.id === campaignId && c.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function resolveContact(campaignId: string, row: Subscriber) {
  const campaign = findCampaign(campaignId);
  if (!campaign?.audienceGroupId) return { email: row.email, name: row.name ?? null };
  const group = findAudienceGroup(campaign.audienceGroupId);
  if (!row.audienceMemberId || !group) return { email: row.email, name: row.name ?? null };
  const member = group.contacts.find((c) => c.id === row.audienceMemberId);
  if (!member) return { email: row.email, name: row.name ?? null };
  return { email: member.email, name: member.name ?? null };
}

function serialize(row: Subscriber, campaignId: string) {
  const contact = resolveContact(campaignId, row);
  return {
    id: row.id,
    campaignId: row.campaignId,
    audienceMemberId: row.audienceMemberId,
    email: contact.email,
    name: contact.name,
    status: row.status,
    source: row.source,
    unsubscribedAt: row.unsubscribedAt ?? null,
    bouncedAt: row.bouncedAt ?? null,
    bounceReason: row.bounceReason ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function isSuppressed(email: string): boolean {
  return store.read().accountSuppressions.some((s) => s.email === email);
}

// GET /crm/campaigns/:campaignId/subscribers?status=&q=
crmSubscribers.get("/", (c) => {
  const campaignId = c.req.param("campaignId")!;
  if (!findCampaign(campaignId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim().toLowerCase();

  let rows = store.read().subscribers.filter((s) => s.campaignId === campaignId);
  if (statusFilter) rows = rows.filter((s) => s.status === statusFilter);
  if (q) {
    rows = rows.filter((s) => {
      const contact = resolveContact(campaignId, s);
      return contact.email.includes(q) || (contact.name ?? "").toLowerCase().includes(q);
    });
  }
  rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({ subscribers: rows.map((row) => serialize(row, campaignId)) });
});

// POST /crm/campaigns/:campaignId/subscribers — disabled; subscribers come from linked audience
crmSubscribers.post("/", async (c) => {
  return c.json(
    {
      error:
        "Subscribers are managed through the campaign's linked audience group. Use Sync from audience on the Subscribers tab.",
    },
    400,
  );
});

// POST /crm/campaigns/:campaignId/subscribers/import
crmSubscribers.post("/import", async (c) => {
  return c.json(
    { error: "Import is disabled. Link an audience group and sync subscribers from there." },
    400,
  );
});

// POST /crm/campaigns/:campaignId/subscribers/import-from-audience-group
crmSubscribers.post("/import-from-audience-group", async (c) => {
  return c.json(
    { error: "Use Sync from audience to refresh subscribers from the campaign's linked group." },
    400,
  );
});

// POST /crm/campaigns/:campaignId/subscribers/sync — refresh from linked audience group
crmSubscribers.post("/sync", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const campaign = findCampaign(campaignId);
  if (!campaign) return c.json({ error: "not found" }, 404);
  if (!campaign.audienceGroupId) {
    return c.json({ error: "campaign has no linked audience group" }, 400);
  }
  const group = findAudienceGroup(campaign.audienceGroupId);
  if (!group) return c.json({ error: "linked audience group not found" }, 404);

  const result = syncCampaignSubscribersFromAudienceGroup(campaignId, campaign.audienceGroupId);
  return c.json(result);
});

// DELETE /crm/campaigns/:campaignId/subscribers/:subscriberId
crmSubscribers.delete("/:subscriberId", (c) => {
  const campaignId = c.req.param("campaignId")!;
  const subscriberId = c.req.param("subscriberId")!;
  const existed = store
    .read()
    .subscribers.some((s) => s.id === subscriberId && s.campaignId === campaignId);
  if (!existed) return c.json({ error: "not found" }, 404);

  store.update((draft) => {
    draft.subscribers = draft.subscribers.filter((s) => s.id !== subscriberId);
  });
  return c.json({ ok: true });
});

// PATCH /crm/campaigns/:campaignId/subscribers/:subscriberId { status: "unsubscribed" | "subscribed" }
crmSubscribers.patch("/:subscriberId", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const subscriberId = c.req.param("subscriberId")!;
  const existing = store
    .read()
    .subscribers.find((s) => s.id === subscriberId && s.campaignId === campaignId);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: { status?: "subscribed" | "unsubscribed" };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (body.status !== "subscribed" && body.status !== "unsubscribed") {
    return c.json({ error: "status must be 'subscribed' or 'unsubscribed'" }, 400);
  }

  const now = new Date().toISOString();
  let updated: Subscriber | null = null;
  store.update((draft) => {
    const idx = draft.subscribers.findIndex((s) => s.id === subscriberId);
    if (idx < 0) return;
    draft.subscribers[idx] = {
      ...draft.subscribers[idx]!,
      status: body.status!,
      unsubscribedAt: body.status === "unsubscribed" ? now : null,
      updatedAt: now,
    };
    updated = draft.subscribers[idx]!;
  });

  return c.json(serialize(updated!, campaignId));
});
