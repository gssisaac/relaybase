import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Broadcast } from "../db/types";
import { resolveActiveAudienceContacts } from "../lib/audience-groups/resolver";
import { findAudienceGroup } from "../lib/audience-groups/group";
import { dispatchBroadcastToAudience } from "../lib/broadcasts/dispatch";
import { aggregateBroadcastLinkClicks } from "../lib/broadcasts/link-clicks";
import { buildInProgressOverview, buildSentOverview } from "../lib/broadcasts/overview";
import { slugifyBroadcast } from "../lib/broadcasts/slug";
import {
  findBroadcast,
  getBroadcastTemplateHtml,
  serializeBroadcast,
} from "../lib/broadcasts/serialize";
import { emptyBroadcastStats } from "../lib/broadcasts/stats";
import { sendMail } from "../lib/mail/sender";
import { buildListUnsubscribeUrl, renderBroadcastForRecipient } from "../lib/render/render";
import { CRM_PUBLIC_BASE_URL } from "../lib/shared/crm-url";
import { newId } from "../lib/shared/ids";
import { crmBroadcastAudience } from "./broadcast-audience";

export const crmBroadcasts = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /crm/broadcasts
crmBroadcasts.get("/", (c) => {
  const rows = store
    .read()
    .broadcasts.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ broadcasts: rows.map(serializeBroadcast) });
});

crmBroadcasts.get("/sent-stats", (c) => {
  const data = store.read();
  const audienceNameById = new Map(data.audienceGroups.map((g) => [g.id, g.name]));
  return c.json(
    buildSentOverview({
      broadcasts: data.broadcasts.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID),
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
      audienceNameById,
    }),
  );
});

crmBroadcasts.get("/in-progress", (c) => {
  const data = store.read();
  const mine = data.broadcasts.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID);
  const sending = mine
    .filter((b) => b.status === "sending")
    .sort((a, b) => (b.startedAt ?? b.sentAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.sentAt ?? a.updatedAt))
    .map(serializeBroadcast);
  const scheduled = mine
    .filter((b) => b.status === "scheduled")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .map(serializeBroadcast);
  return c.json(
    buildInProgressOverview({
      sending,
      scheduled,
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
    }),
  );
});

// POST /crm/broadcasts { name, audienceGroupId, ... }
crmBroadcasts.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    workerUrl?: string;
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
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) return c.json({ error: "Select a sending domain for this broadcast" }, 400);
  const audienceGroupId = body.audienceGroupId?.trim();
  if (!audienceGroupId) return c.json({ error: "Select an audience group for this broadcast" }, 400);
  const audienceGroup = findAudienceGroup(audienceGroupId);
  if (!audienceGroup) return c.json({ error: "Audience group not found" }, 404);
  if (audienceGroup.domain.toLowerCase() !== domain) {
    return c.json({ error: "Audience group must belong to the selected domain" }, 400);
  }
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;
  store.update((draft) => {
    draft.account.domain = domain;
    if (workerUrl) draft.account.workerUrl = workerUrl;
  });
  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  const data = store.read();
  const baseSlug = slugifyBroadcast(body.slug?.trim() || name) || newId("broadcast").slice(0, 12);
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
      domain,
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
      startedAt: null,
      finishedAt: null,
      targetFilter: undefined,
      stats: emptyBroadcastStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.broadcasts.push(created);
  });

  return c.json(serializeBroadcast(created!), 201);
});

crmBroadcasts.route("/:broadcastId/audience", crmBroadcastAudience);

// GET /crm/broadcasts/:id
crmBroadcasts.get("/:id", (c) => {
  const row = findBroadcast(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serializeBroadcast(row));
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
    domain?: string;
    workerUrl?: string;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
    defaultTemplateId?: string | null;
    complianceIdentityId?: string | null;
    listStatus?: "active" | "archived";
    subject?: string;
    previewText?: string;
    bodyMarkdown?: string;
    templateId?: string;
    audienceGroupId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const audienceGroupIdPatch =
    body.audienceGroupId !== undefined ? body.audienceGroupId.trim() : undefined;
  if (audienceGroupIdPatch !== undefined) {
    if (existing.status !== "draft" && existing.status !== "scheduled") {
      return c.json({ error: "Audience can only be changed before send" }, 409);
    }
    if (!audienceGroupIdPatch) {
      return c.json({ error: "Select an audience group" }, 400);
    }
    const nextGroup = findAudienceGroup(audienceGroupIdPatch);
    if (!nextGroup) return c.json({ error: "Audience group not found" }, 404);
    const domainFromBody = body.domain?.trim().toLowerCase();
    const effectiveDomain = (
      domainFromBody ??
      existing.domain ??
      (existing.audienceGroupId ? findAudienceGroup(existing.audienceGroupId)?.domain : "") ??
      ""
    ).toLowerCase();
    if (!effectiveDomain) {
      return c.json({ error: "Select a sending domain before linking an audience" }, 400);
    }
    if (nextGroup.domain.toLowerCase() !== effectiveDomain) {
      return c.json(
        {
          error: `Audience group is on ${nextGroup.domain}. Choose a group on ${effectiveDomain}.`,
        },
        400,
      );
    }
  }

  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  if (body.complianceIdentityId !== undefined && body.complianceIdentityId !== null) {
    const identityId = body.complianceIdentityId.trim();
    const exists = store.read().complianceIdentities.some((row) => row.id === identityId);
    if (!exists) return c.json({ error: "Compliance sender not found" }, 400);
  }

  const domainPatch = body.domain?.trim().toLowerCase();
  if (domainPatch !== undefined) {
    if (!domainPatch) {
      return c.json({ error: "Select a sending domain" }, 400);
    }
    const group = existing.audienceGroupId ? findAudienceGroup(existing.audienceGroupId) : undefined;
    const prevDomain = (existing.domain || group?.domain || "").toLowerCase();
    const domainChanging = domainPatch !== prevDomain;
    if (domainChanging) {
      if (group && group.domain.toLowerCase() !== domainPatch) {
        return c.json(
          {
            error: `Audience group is on ${group.domain}. Choose that domain or change the linked audience.`,
          },
          400,
        );
      }
      if (existing.status !== "draft") {
        return c.json({ error: "Sending domain can only be changed on draft broadcasts" }, 409);
      }
    }
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

  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;

  const now = new Date().toISOString();
  let updated: Broadcast | null = null;
  store.update((draft) => {
    if (domainPatch) {
      draft.account.domain = domainPatch;
      if (workerUrl) draft.account.workerUrl = workerUrl;
    }
    const idx = draft.broadcasts.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const prev = draft.broadcasts[idx]!;
    const prevGroup = prev.audienceGroupId ? findAudienceGroup(prev.audienceGroupId) : undefined;
    const nextAudienceGroupId =
      audienceGroupIdPatch !== undefined ? audienceGroupIdPatch : prev.audienceGroupId;
    const nextGroup =
      audienceGroupIdPatch !== undefined ? findAudienceGroup(audienceGroupIdPatch) : prevGroup;
    let nextFromEmail = prev.fromEmail;
    if (
      audienceGroupIdPatch !== undefined &&
      nextGroup &&
      (!prev.fromEmail || prev.fromEmail === prevGroup?.defaultFrom)
    ) {
      nextFromEmail = nextGroup.defaultFrom ?? prev.fromEmail;
    }
    const resolvedFromEmail =
      body.fromEmail !== undefined ? body.fromEmail?.trim() || null : nextFromEmail;
    draft.broadcasts[idx] = {
      ...prev,
      audienceGroupId: nextAudienceGroupId,
      name: body.name?.trim() || prev.name,
      slug: body.slug?.trim() ? slugifyBroadcast(body.slug) : prev.slug,
      description: body.description !== undefined ? body.description : prev.description,
      domain: domainPatch ?? prev.domain,
      fromName: body.fromName !== undefined ? body.fromName?.trim() || null : prev.fromName,
      fromEmail: resolvedFromEmail,
      replyTo: body.replyTo !== undefined ? body.replyTo?.trim() || null : prev.replyTo,
      defaultTemplateId:
        body.defaultTemplateId !== undefined ? body.defaultTemplateId : prev.defaultTemplateId,
      complianceIdentityId:
        body.complianceIdentityId !== undefined
          ? body.complianceIdentityId?.trim() || null
          : prev.complianceIdentityId ?? null,
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

  return c.json(serializeBroadcast(updated!));
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
    getBroadcastTemplateHtml(broadcast.templateId ?? broadcast.defaultTemplateId) ??
    "<div>{{content}}</div>";
  const html = renderBroadcastForRecipient({
    broadcastId: broadcast.id,
    recipientId: "test",
    bodyMarkdown: broadcast.bodyMarkdown,
    templateId: broadcast.templateId ?? broadcast.defaultTemplateId,
    templateHtml,
    recipient: { email: to, name: "Test Recipient" },
    unsubscribeToken: "test",
    crmBaseUrl: CRM_PUBLIC_BASE_URL,
  });
  const listUnsubscribeUrl = buildListUnsubscribeUrl(CRM_PUBLIC_BASE_URL, broadcast.id, "test");
  const result = await sendMail({
    to,
    subject: `[Test] ${broadcast.subject}`,
    html,
    listUnsubscribeUrl,
  });
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
      draft.broadcasts[idx] = {
        ...draft.broadcasts[idx]!,
        status: "sending",
        sentAt: now,
        startedAt: now,
        finishedAt: null,
        updatedAt: now,
      };
    }
  });

  const result = await dispatchBroadcastToAudience(
    store.read().broadcasts.find((b) => b.id === id)!,
    members,
  );
  const row = store.read().broadcasts.find((r) => r.id === id)!;
  return c.json({ broadcast: serializeBroadcast(row), ...result });
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

  return c.json(serializeBroadcast(store.read().broadcasts.find((r) => r.id === id)!));
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

  return c.json(serializeBroadcast(store.read().broadcasts.find((r) => r.id === id)!));
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
      startedAt: null,
      finishedAt: null,
      stats: emptyBroadcastStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.broadcasts.push(created);
  });

  return c.json(serializeBroadcast(created!), 201);
});

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
    broadcast: serializeBroadcast(broadcast),
    trackingEvents: trackingEvents.map((e) => ({
      id: e.id,
      recipientId: e.recipientId,
      memberEmail: e.memberEmail,
      type: e.type,
      url: e.url ?? null,
      reason: e.reason ?? null,
      occurredAt: e.occurredAt,
    })),
    linkClicks: aggregateBroadcastLinkClicks(id),
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
