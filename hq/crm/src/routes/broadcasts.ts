import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceMember, Broadcast } from "../db/types";
import {
  audienceActiveCountForBroadcast,
  resolveActiveAudienceContacts,
} from "../lib/audience-resolver";
import { findAudienceGroup } from "../lib/broadcast-audience-sync";
import { emptyBroadcastStats } from "../lib/broadcast-stats";
import { newId } from "../lib/ids";
import { renderBroadcastForRecipient } from "../lib/render";
import { sendMail } from "../lib/mail-sender";
import { crmBroadcastAudience } from "./broadcast-audience";

export const crmBroadcasts = new Hono();

const CRM_BASE_URL = process.env.CRM_PUBLIC_BASE_URL ?? "http://localhost:32831";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function findBroadcast(id: string): Broadcast | undefined {
  return store.read().broadcasts.find((b) => b.id === id && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function serialize(row: Broadcast) {
  const group = row.audienceGroupId ? findAudienceGroup(row.audienceGroupId) : undefined;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    audienceGroupId: row.audienceGroupId || null,
    audienceGroupName: group?.name ?? null,
    audienceGroupDomain: group?.domain ?? null,
    audienceContactCount: group?.contacts.length ?? null,
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    defaultTemplateId: row.defaultTemplateId ?? null,
    listStatus: row.listStatus,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    templateId: row.templateId ?? null,
    status: row.status,
    scheduledAt: row.scheduledAt ?? null,
    sentAt: row.sentAt ?? null,
    stats: row.stats,
    audienceActiveCount: audienceActiveCountForBroadcast(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getTemplateHtml(templateId: string | null | undefined): string | null {
  if (!templateId) return null;
  return store.read().templates.find((t) => t.id === templateId)?.htmlSource ?? null;
}

export async function dispatchBroadcastToAudience(
  broadcast: Broadcast,
  members: AudienceMember[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = new Date().toISOString();

  store.update((draft) => {
    for (const m of members) {
      draft.recipients.push({
        id: newId("recipient"),
        broadcastId: broadcast.id,
        audienceMemberId: m.id,
        email: m.email,
        name: m.name ?? null,
        status: "queued",
        errorMessage: null,
        bounceReason: null,
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        unsubscribedAt: null,
        openCount: 0,
        clickCount: 0,
        createdAt: now,
      });
    }
  });

  const templateHtml =
    getTemplateHtml(broadcast.templateId ?? broadcast.defaultTemplateId) ?? "<div>{{content}}</div>";

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const queued = store
    .read()
    .recipients.filter((r) => r.broadcastId === broadcast.id && r.status === "queued");

  for (const recipient of queued) {
    const member = store
      .read()
      .audienceGroups.flatMap((g) => g.contacts)
      .find((m) => m.id === recipient.audienceMemberId);
    if (!member || member.sendStatus !== "active") {
      skipped += 1;
      store.update((draft) => {
        const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
        if (idx >= 0) draft.recipients[idx] = { ...draft.recipients[idx]!, status: "skipped" };
      });
      continue;
    }

    const html = renderBroadcastForRecipient({
      broadcastId: broadcast.id,
      recipientId: recipient.id,
      bodyMarkdown: broadcast.bodyMarkdown,
      templateHtml,
      recipient: { email: recipient.email, name: recipient.name },
      unsubscribeToken: member.unsubscribeToken,
      crmBaseUrl: CRM_BASE_URL,
    });
    const result = await sendMail({ to: recipient.email, subject: broadcast.subject, html });
    const sentAt = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        status: result.ok ? "delivered" : "failed",
        sentAt: result.ok ? sentAt : draft.recipients[idx]!.sentAt,
        deliveredAt: result.ok ? sentAt : null,
        errorMessage: result.ok ? null : result.error,
      };
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  store.update((draft) => {
    const idx = draft.broadcasts.findIndex((b) => b.id === broadcast.id);
    if (idx < 0) return;
    const prev = draft.broadcasts[idx]!.stats;
    draft.broadcasts[idx] = {
      ...draft.broadcasts[idx]!,
      status: "sent",
      sentAt: draft.broadcasts[idx]!.sentAt ?? now,
      stats: {
        ...prev,
        sent,
        delivered: sent,
        failed,
      },
      updatedAt: new Date().toISOString(),
    };
  });

  return { sent, failed, skipped };
}

crmBroadcasts.route("/:broadcastId/audience", crmBroadcastAudience);

// GET /crm/broadcasts
crmBroadcasts.get("/", (c) => {
  const rows = store
    .read()
    .broadcasts.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ broadcasts: rows.map(serialize) });
});

// POST /crm/broadcasts { name, audienceGroupId, ... }
crmBroadcasts.post("/", async (c) => {
  let body: {
    name?: string;
    audienceGroupId?: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultTemplateId?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }

  const name = body.name?.trim();
  if (!name) return c.json({ error: "Broadcast name is required" }, 400);
  const audienceGroupId = body.audienceGroupId?.trim();
  if (!audienceGroupId) return c.json({ error: "Select an audience group for this broadcast" }, 400);
  const audienceGroup = findAudienceGroup(audienceGroupId);
  if (!audienceGroup) return c.json({ error: "Audience group not found" }, 404);
  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  const data = store.read();
  const baseSlug = slugify(body.slug?.trim() || name) || newId("broadcast").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (data.broadcasts.some((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const id = newId("broadcast");
  const now = new Date().toISOString();
  let created: Broadcast | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      slug,
      description: null,
      audienceGroupId,
      fromName: body.fromName?.trim() || null,
      fromEmail: body.fromEmail?.trim() || audienceGroup.defaultFrom || null,
      replyTo: body.replyTo?.trim() || null,
      defaultTemplateId: body.defaultTemplateId || null,
      listStatus: "active",
      subject: "",
      previewText: null,
      bodyMarkdown: "",
      templateId: body.defaultTemplateId || null,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      targetFilter: undefined,
      stats: emptyBroadcastStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.broadcasts.push(created);
  });

  return c.json(serialize(created!), 201);
});

// GET /crm/broadcasts/:id
crmBroadcasts.get("/:id", (c) => {
  const row = findBroadcast(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serialize(row));
});

// PATCH /crm/broadcasts/:id
crmBroadcasts.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = findBroadcast(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    slug?: string;
    description?: string | null;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
    defaultTemplateId?: string | null;
    listStatus?: "active" | "archived";
    subject?: string;
    previewText?: string;
    bodyMarkdown?: string;
    templateId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  const contentTouched =
    body.subject !== undefined ||
    body.previewText !== undefined ||
    body.bodyMarkdown !== undefined ||
    body.templateId !== undefined;

  if (contentTouched && existing.status !== "draft") {
    return c.json({ error: "sent broadcasts are locked — duplicate as a new draft to edit" }, 409);
  }

  if (body.listStatus === "archived" && existing.listStatus !== "archived") {
    const sending = store.read().broadcasts.find((b) => b.id === id && b.status === "sending");
    if (sending) {
      return c.json(
        {
          error: `Cannot archive broadcast while '${sending.subject || sending.name}' is currently sending.`,
        },
        409,
      );
    }
  }

  const now = new Date().toISOString();
  let updated: Broadcast | null = null;
  store.update((draft) => {
    const idx = draft.broadcasts.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const prev = draft.broadcasts[idx]!;
    draft.broadcasts[idx] = {
      ...prev,
      name: body.name?.trim() || prev.name,
      slug: body.slug?.trim() ? slugify(body.slug) : prev.slug,
      description: body.description !== undefined ? body.description : prev.description,
      fromName: body.fromName !== undefined ? body.fromName?.trim() || null : prev.fromName,
      fromEmail: body.fromEmail !== undefined ? body.fromEmail?.trim() || null : prev.fromEmail,
      replyTo: body.replyTo !== undefined ? body.replyTo?.trim() || null : prev.replyTo,
      defaultTemplateId:
        body.defaultTemplateId !== undefined ? body.defaultTemplateId : prev.defaultTemplateId,
      listStatus: body.listStatus ?? prev.listStatus,
      subject: body.subject ?? prev.subject,
      previewText: body.previewText !== undefined ? body.previewText : prev.previewText,
      bodyMarkdown: body.bodyMarkdown ?? prev.bodyMarkdown,
      templateId: body.templateId !== undefined ? body.templateId : prev.templateId,
      updatedAt: now,
    };
    updated = draft.broadcasts[idx]!;

    if (body.listStatus === "archived" && prev.listStatus !== "archived" && prev.status === "scheduled") {
      draft.scheduledJobs = draft.scheduledJobs.filter(
        (j) => !(j.kind === "broadcast" && j.refId === id && j.status === "pending"),
      );
      draft.broadcasts[idx] = {
        ...draft.broadcasts[idx]!,
        status: "draft",
        scheduledAt: null,
      };
    }
  });

  return c.json(serialize(updated!));
});

crmBroadcasts.post("/:id/test-send", async (c) => {
  const broadcast = findBroadcast(c.req.param("id")!);
  if (!broadcast) return c.json({ error: "not found" }, 404);

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
    getTemplateHtml(broadcast.templateId ?? broadcast.defaultTemplateId) ?? "<div>{{content}}</div>";
  const html = renderBroadcastForRecipient({
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

crmBroadcasts.post("/:id/send", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findBroadcast(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "draft") {
    return c.json({ error: `cannot send from status "${broadcast.status}"` }, 409);
  }
  if (!broadcast.subject.trim()) {
    return c.json({ error: "Subject is required before sending. Enter a subject in the Content tab." }, 400);
  }

  const members = resolveActiveAudienceContacts(broadcast);
  if (members.length === 0) {
    return c.json(
      { error: "Cannot send: this broadcast has 0 active audience contacts in the linked group." },
      400,
    );
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.broadcasts.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.broadcasts[idx] = { ...draft.broadcasts[idx]!, status: "sending", sentAt: now, updatedAt: now };
    }
  });

  const result = await dispatchBroadcastToAudience(
    store.read().broadcasts.find((b) => b.id === id)!,
    members,
  );
  const row = store.read().broadcasts.find((r) => r.id === id)!;
  return c.json({ broadcast: serialize(row), ...result });
});

crmBroadcasts.post("/:id/schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findBroadcast(id);
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
      refId: id,
      runAt,
      status: "pending",
      createdAt: now,
    });
    const idx = draft.broadcasts.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.broadcasts[idx] = {
        ...draft.broadcasts[idx]!,
        status: "scheduled",
        scheduledAt: runAt,
        updatedAt: now,
      };
    }
  });

  return c.json(serialize(store.read().broadcasts.find((r) => r.id === id)!));
});

crmBroadcasts.post("/:id/cancel-schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findBroadcast(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "scheduled") {
    return c.json({ error: "Cannot cancel: Broadcast dispatch has already begun." }, 409);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    draft.scheduledJobs = draft.scheduledJobs.filter(
      (j) => !(j.kind === "broadcast" && j.refId === id && j.status === "pending"),
    );
    const idx = draft.broadcasts.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.broadcasts[idx] = {
        ...draft.broadcasts[idx]!,
        status: "draft",
        scheduledAt: null,
        updatedAt: now,
      };
    }
  });

  return c.json(serialize(store.read().broadcasts.find((r) => r.id === id)!));
});

crmBroadcasts.post("/:id/duplicate", (c) => {
  const source = findBroadcast(c.req.param("id")!);
  if (!source) return c.json({ error: "not found" }, 404);

  const id = newId("broadcast");
  const now = new Date().toISOString();
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (store.read().broadcasts.some((b) => b.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  let created: Broadcast | null = null;
  store.update((draft) => {
    created = {
      ...source,
      id,
      name: `${source.name} (copy)`,
      slug,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      stats: emptyBroadcastStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.broadcasts.push(created);
  });

  return c.json(serialize(created!), 201);
});

function aggregateLinkClicks(broadcastId: string) {
  const events = store
    .read()
    .trackingEvents.filter((e) => e.broadcastId === broadcastId && e.type === "click" && e.url);
  const byUrl = new Map<string, { url: string; clicks: number; uniqueRecipients: Set<string> }>();
  for (const event of events) {
    const url = event.url!;
    let row = byUrl.get(url);
    if (!row) {
      row = { url, clicks: 0, uniqueRecipients: new Set() };
      byUrl.set(url, row);
    }
    row.clicks += 1;
    row.uniqueRecipients.add(event.recipientId);
  }
  return [...byUrl.values()]
    .map((row) => ({
      url: row.url,
      clicks: row.clicks,
      uniqueClicks: row.uniqueRecipients.size,
    }))
    .sort((a, b) => b.clicks - a.clicks || a.url.localeCompare(b.url));
}

crmBroadcasts.get("/:id/stats", (c) => {
  const id = c.req.param("id")!;
  const broadcast = findBroadcast(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);

  const data = store.read();
  const recipients = data.recipients
    .filter((r) => r.broadcastId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const trackingEvents = data.trackingEvents
    .filter((e) => e.broadcastId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return c.json({
    broadcast: serialize(broadcast),
    trackingEvents: trackingEvents.map((e) => ({
      id: e.id,
      recipientId: e.recipientId,
      memberEmail: e.memberEmail,
      type: e.type,
      url: e.url ?? null,
      reason: e.reason ?? null,
      occurredAt: e.occurredAt,
    })),
    linkClicks: aggregateLinkClicks(id),
    recipients: recipients.map((r) => ({
      id: r.id,
      audienceMemberId: r.audienceMemberId,
      email: r.email,
      name: r.name ?? null,
      status: r.status,
      errorMessage: r.errorMessage ?? null,
      bounceReason: r.bounceReason ?? null,
      sentAt: r.sentAt ?? null,
      deliveredAt: r.deliveredAt ?? null,
      openedAt: r.openedAt ?? null,
      clickedAt: r.clickedAt ?? null,
      unsubscribedAt: r.unsubscribedAt ?? null,
      openCount: r.openCount,
      clickCount: r.clickCount,
    })),
  });
});
