import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Broadcast, Campaign, Subscriber } from "../db/types";
import { newId } from "../lib/ids";
import { renderBroadcastForRecipient } from "../lib/render";
import { sendMail } from "../lib/mail-sender";

export const crmBroadcasts = new Hono();

const CRM_BASE_URL = process.env.CRM_PUBLIC_BASE_URL ?? "http://localhost:32831";

function serialize(row: Broadcast) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    templateId: row.templateId ?? null,
    status: row.status,
    scheduledAt: row.scheduledAt ?? null,
    sentAt: row.sentAt ?? null,
    stats: row.stats,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function findCampaign(campaignId: string): Campaign | undefined {
  return store.read().campaigns.find((c) => c.id === campaignId && c.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function findBroadcast(campaignId: string, broadcastId: string): Broadcast | undefined {
  return store.read().broadcasts.find((b) => b.id === broadcastId && b.campaignId === campaignId);
}

function getTemplateHtml(templateId: string | null | undefined): string | null {
  if (!templateId) return null;
  return store.read().templates.find((t) => t.id === templateId)?.htmlSource ?? null;
}

/** Active, deliverable subscribers for a campaign at this exact moment (spec §1.3 late-binding). */
export function resolveActiveSubscribers(campaignId: string): Subscriber[] {
  const data = store.read();
  const suppressed = new Set(data.accountSuppressions.map((s) => s.email));
  return data.subscribers.filter(
    (s) => s.campaignId === campaignId && s.status === "subscribed" && !suppressed.has(s.email),
  );
}

/** UC-D2: rate-limited sequential dispatch against a resolved subscriber snapshot. */
export async function dispatchBroadcastToSubscribers(
  broadcast: Broadcast,
  subscribers: Subscriber[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const campaign = findCampaign(broadcast.campaignId);
  const now = new Date().toISOString();

  store.update((draft) => {
    for (const s of subscribers) {
      draft.recipients.push({
        id: newId("recipient"),
        broadcastId: broadcast.id,
        subscriberId: s.id,
        campaignId: broadcast.campaignId,
        email: s.email,
        name: s.name ?? null,
        status: "queued",
        errorMessage: null,
        sentAt: null,
        openedAt: null,
        clickedAt: null,
        openCount: 0,
        clickCount: 0,
        createdAt: now,
      });
    }
  });

  const templateHtml =
    getTemplateHtml(broadcast.templateId ?? campaign?.defaultTemplateId) ?? "<div>{{content}}</div>";

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const queued = store
    .read()
    .recipients.filter((r) => r.broadcastId === broadcast.id && r.status === "queued");

  for (const recipient of queued) {
    const subscriber = store.read().subscribers.find((s) => s.id === recipient.subscriberId);
    if (!subscriber || subscriber.status !== "subscribed") {
      skipped += 1;
      store.update((draft) => {
        const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
        if (idx >= 0) draft.recipients[idx] = { ...draft.recipients[idx]!, status: "skipped" };
      });
      continue;
    }

    const html = renderBroadcastForRecipient({
      campaignId: broadcast.campaignId,
      broadcastId: broadcast.id,
      recipientId: recipient.id,
      bodyMarkdown: broadcast.bodyMarkdown,
      templateHtml,
      recipient: { email: recipient.email, name: recipient.name },
      unsubscribeToken: subscriber.unsubscribeToken,
      crmBaseUrl: CRM_BASE_URL,
    });
    const result = await sendMail({ to: recipient.email, subject: broadcast.subject, html });
    const sentAt = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        status: result.ok ? "sent" : "failed",
        sentAt: result.ok ? sentAt : draft.recipients[idx]!.sentAt,
        errorMessage: result.ok ? null : result.error,
      };
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  store.update((draft) => {
    const idx = draft.broadcasts.findIndex((b) => b.id === broadcast.id);
    if (idx < 0) return;
    draft.broadcasts[idx] = {
      ...draft.broadcasts[idx]!,
      status: "sent",
      sentAt: draft.broadcasts[idx]!.sentAt ?? now,
      stats: { ...draft.broadcasts[idx]!.stats, sent, failed },
      updatedAt: new Date().toISOString(),
    };
  });

  return { sent, failed, skipped };
}

// GET /crm/campaigns/:campaignId/broadcasts
crmBroadcasts.get("/", (c) => {
  const campaignId = c.req.param("campaignId")!;
  if (!findCampaign(campaignId)) return c.json({ error: "not found" }, 404);
  const rows = store
    .read()
    .broadcasts.filter((b) => b.campaignId === campaignId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ broadcasts: rows.map(serialize) });
});

// POST /crm/campaigns/:campaignId/broadcasts — UC-B1
crmBroadcasts.post("/", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const campaign = findCampaign(campaignId);
  if (!campaign) return c.json({ error: "not found" }, 404);

  const id = newId("broadcast");
  const now = new Date().toISOString();
  let created: Broadcast | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      campaignId,
      subject: "",
      previewText: null,
      bodyMarkdown: "",
      templateId: campaign.defaultTemplateId ?? null,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      targetFilter: undefined,
      stats: { sent: 0, opened: 0, clicked: 0, failed: 0 },
      createdAt: now,
      updatedAt: now,
    };
    draft.broadcasts.push(created);
  });

  return c.json(serialize(created!), 201);
});

// GET /crm/campaigns/:campaignId/broadcasts/:broadcastId
crmBroadcasts.get("/:broadcastId", (c) => {
  const row = findBroadcast(c.req.param("campaignId")!, c.req.param("broadcastId")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serialize(row));
});

// PATCH /crm/campaigns/:campaignId/broadcasts/:broadcastId — UC-B2 autosave
crmBroadcasts.patch("/:broadcastId", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcastId = c.req.param("broadcastId")!;
  const existing = findBroadcast(campaignId, broadcastId);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft") {
    return c.json({ error: "sent broadcasts are locked — duplicate as a new draft to edit" }, 409);
  }

  let body: { subject?: string; previewText?: string; bodyMarkdown?: string; templateId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  let updated: Broadcast | null = null;
  store.update((draft) => {
    const idx = draft.broadcasts.findIndex((r) => r.id === broadcastId);
    if (idx < 0) return;
    const prev = draft.broadcasts[idx]!;
    draft.broadcasts[idx] = {
      ...prev,
      subject: body.subject ?? prev.subject,
      previewText: body.previewText !== undefined ? body.previewText : prev.previewText,
      bodyMarkdown: body.bodyMarkdown ?? prev.bodyMarkdown,
      templateId: body.templateId !== undefined ? body.templateId : prev.templateId,
      updatedAt: new Date().toISOString(),
    };
    updated = draft.broadcasts[idx]!;
  });

  return c.json(serialize(updated!));
});

// POST /crm/campaigns/:campaignId/broadcasts/:broadcastId/test-send { to } — UC-B3
crmBroadcasts.post("/:broadcastId/test-send", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcast = findBroadcast(campaignId, c.req.param("broadcastId")!);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  const campaign = findCampaign(campaignId);

  let body: { to?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const to = body.to?.trim();
  if (!to || !to.includes("@")) {
    return c.json({ error: "Please enter a valid email address" }, 400);
  }

  const templateHtml =
    getTemplateHtml(broadcast.templateId ?? campaign?.defaultTemplateId) ?? "<div>{{content}}</div>";
  const html = renderBroadcastForRecipient({
    campaignId,
    broadcastId: broadcast.id,
    recipientId: "test",
    bodyMarkdown: broadcast.bodyMarkdown,
    templateHtml,
    recipient: { email: to, name: "Test Recipient" },
    unsubscribeToken: "test",
    crmBaseUrl: CRM_BASE_URL,
  });
  const result = await sendMail({ to, subject: `[Test] ${broadcast.subject}`, html });
  if (!result.ok) {
    return c.json({ error: "Worker rejected test send: Rate limit exceeded or invalid API key" }, 502);
  }
  return c.json({ ok: true });
});

// POST /crm/campaigns/:campaignId/broadcasts/:broadcastId/send — UC-B4
crmBroadcasts.post("/:broadcastId/send", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcastId = c.req.param("broadcastId")!;
  const broadcast = findBroadcast(campaignId, broadcastId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "draft") {
    return c.json({ error: `cannot send from status "${broadcast.status}"` }, 409);
  }
  if (!broadcast.subject.trim()) {
    return c.json({ error: "Subject is required before sending. Enter a subject in the Content tab." }, 400);
  }

  const subscribers = resolveActiveSubscribers(campaignId);
  if (subscribers.length === 0) {
    return c.json(
      { error: "Cannot send broadcast: This campaign has 0 active subscribers. Add subscribers before sending." },
      400,
    );
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.broadcasts.findIndex((r) => r.id === broadcastId);
    if (idx >= 0) {
      draft.broadcasts[idx] = { ...draft.broadcasts[idx]!, status: "sending", sentAt: now, updatedAt: now };
    }
  });

  const result = await dispatchBroadcastToSubscribers(
    store.read().broadcasts.find((b) => b.id === broadcastId)!,
    subscribers,
  );
  const row = store.read().broadcasts.find((r) => r.id === broadcastId)!;
  return c.json({ broadcast: serialize(row), ...result });
});

// POST /crm/campaigns/:campaignId/broadcasts/:broadcastId/schedule { runAt } — UC-B5
crmBroadcasts.post("/:broadcastId/schedule", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcastId = c.req.param("broadcastId")!;
  const broadcast = findBroadcast(campaignId, broadcastId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "draft") {
    return c.json({ error: `cannot schedule from status "${broadcast.status}"` }, 409);
  }
  if (!broadcast.subject.trim()) {
    return c.json({ error: "Subject is required before sending. Enter a subject in the Content tab." }, 400);
  }

  let body: { runAt?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const runAt = body.runAt;
  if (!runAt || new Date(runAt).getTime() <= Date.now()) {
    return c.json({ error: "runAt must be a future time" }, 400);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    draft.scheduledJobs.push({
      id: newId("job"),
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      kind: "broadcast",
      refId: broadcastId,
      runAt,
      status: "pending",
      createdAt: now,
    });
    const idx = draft.broadcasts.findIndex((r) => r.id === broadcastId);
    if (idx >= 0) {
      draft.broadcasts[idx] = {
        ...draft.broadcasts[idx]!,
        status: "scheduled",
        scheduledAt: runAt,
        updatedAt: now,
      };
    }
  });

  return c.json(serialize(store.read().broadcasts.find((r) => r.id === broadcastId)!));
});

// POST /crm/campaigns/:campaignId/broadcasts/:broadcastId/cancel-schedule — UC-B6
crmBroadcasts.post("/:broadcastId/cancel-schedule", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcastId = c.req.param("broadcastId")!;
  const broadcast = findBroadcast(campaignId, broadcastId);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "scheduled") {
    return c.json({ error: "Cannot cancel: Broadcast dispatch has already begun." }, 409);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    draft.scheduledJobs = draft.scheduledJobs.filter(
      (j) => !(j.kind === "broadcast" && j.refId === broadcastId && j.status === "pending"),
    );
    const idx = draft.broadcasts.findIndex((r) => r.id === broadcastId);
    if (idx >= 0) {
      draft.broadcasts[idx] = {
        ...draft.broadcasts[idx]!,
        status: "draft",
        scheduledAt: null,
        updatedAt: now,
      };
    }
  });

  return c.json(serialize(store.read().broadcasts.find((r) => r.id === broadcastId)!));
});

// POST /crm/campaigns/:campaignId/broadcasts/:broadcastId/duplicate — UC-B7
crmBroadcasts.post("/:broadcastId/duplicate", (c) => {
  const campaignId = c.req.param("campaignId")!;
  const source = findBroadcast(campaignId, c.req.param("broadcastId")!);
  if (!source) return c.json({ error: "not found" }, 404);

  const id = newId("broadcast");
  const now = new Date().toISOString();
  let created: Broadcast | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      campaignId,
      subject: source.subject,
      previewText: source.previewText ?? null,
      bodyMarkdown: source.bodyMarkdown,
      templateId: source.templateId ?? null,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      targetFilter: undefined,
      stats: { sent: 0, opened: 0, clicked: 0, failed: 0 },
      createdAt: now,
      updatedAt: now,
    };
    draft.broadcasts.push(created);
  });

  return c.json(serialize(created!), 201);
});

// GET /crm/campaigns/:campaignId/broadcasts/:broadcastId/stats — UC-D3
crmBroadcasts.get("/:broadcastId/stats", (c) => {
  const campaignId = c.req.param("campaignId")!;
  const broadcastId = c.req.param("broadcastId")!;
  const broadcast = findBroadcast(campaignId, broadcastId);
  if (!broadcast) return c.json({ error: "not found" }, 404);

  const recipients = store
    .read()
    .recipients.filter((r) => r.broadcastId === broadcastId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({
    broadcast: serialize(broadcast),
    recipients: recipients.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name ?? null,
      status: r.status,
      errorMessage: r.errorMessage ?? null,
      sentAt: r.sentAt ?? null,
      openedAt: r.openedAt ?? null,
      clickedAt: r.clickedAt ?? null,
      openCount: r.openCount,
      clickCount: r.clickCount,
    })),
  });
});
