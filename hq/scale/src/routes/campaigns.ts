import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Campaign } from "../db/types";
import { createMessageTemplate, patchMessageTemplate } from "../lib/messages/message-template";
import { requireMessage } from "../lib/messages/resolve";
import { resolveActiveAudienceContacts } from "../lib/audience-groups/resolver";
import { findAudienceGroup } from "../lib/audience-groups/group";
import { dispatchCampaignToAudience } from "../lib/campaigns/dispatch";
import { resolveWorkerSendCredentials } from "../lib/mail/credentials";
import { buildCampaignDispatchProgress } from "../lib/campaigns/dispatch-progress";
import { aggregateCampaignLinkClicks } from "../lib/campaigns/link-clicks";
import { buildCampaignInProgressOverview, buildSentOverview } from "../lib/campaigns/overview";
import { slugifyCampaign } from "../lib/campaigns/slug";
import {
  findCampaign,
  getCampaignLayoutHtml,
  getCampaignLayoutSchema,
  serializeCampaign,
} from "../lib/campaigns/serialize";
import { emptyCampaignStats } from "../lib/campaigns/stats";
import { sendMail } from "../lib/mail/sender";
import { buildListUnsubscribeUrl, renderCampaignForRecipient } from "../lib/render/render";
import { SCALE_PUBLIC_BASE_URL } from "../lib/shared/scale-url";
import { newId, newToken } from "../lib/shared/ids";
import { scaleCampaignAudience } from "./campaign-audience";

export const scaleCampaigns = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveTestSendUnsubscribeToken(broadcast: Campaign, toEmail: string): string {
  if (!broadcast.audienceGroupId) return newToken();
  const group = findAudienceGroup(broadcast.audienceGroupId);
  const normalized = toEmail.trim().toLowerCase();
  const contact = group?.contacts.find((c) => c.email.trim().toLowerCase() === normalized);
  return contact?.unsubscribeToken ?? newToken();
}

/** Atomically move draft → sending so duplicate POST /send cannot double-dispatch. */
function claimCampaignForSend(id: string): Campaign | null {
  let claimed: Campaign | null = null;
  store.update((draft) => {
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const row = draft.campaigns[idx]!;
    if (row.status !== "draft") return;
    const now = new Date().toISOString();
    claimed = {
      ...row,
      status: "sending",
      sentAt: now,
      startedAt: now,
      finishedAt: null,
      updatedAt: now,
    };
    draft.campaigns[idx] = claimed;
  });
  return claimed;
}

function sanitizeTemplateVariables(raw: Record<string, string> | undefined): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)*$/.test(key)) continue;
    out[key] = value.trim();
  }
  return out;
}

// GET /scale/broadcasts
scaleCampaigns.get("/", (c) => {
  const rows = store
    .read()
    .campaigns.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ campaigns: rows.map(serializeCampaign) });
});

scaleCampaigns.get("/sent-stats", (c) => {
  const data = store.read();
  const audienceNameById = new Map(data.audienceGroups.map((g) => [g.id, g.name]));
  return c.json(
    buildSentOverview({
      campaigns: data.campaigns.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID),
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
      audienceNameById,
    }),
  );
});

scaleCampaigns.get("/in-progress", (c) => {
  const data = store.read();
  const mine = data.campaigns.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID);
  const sending = mine
    .filter((b) => b.status === "sending")
    .sort((a, b) => (b.startedAt ?? b.sentAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.sentAt ?? a.updatedAt))
    .map(serializeCampaign);
  const scheduled = mine
    .filter((b) => b.status === "scheduled")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .map(serializeCampaign);
  return c.json(
    buildCampaignInProgressOverview({
      sending,
      scheduled,
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
    }),
  );
});

// POST /scale/broadcasts { name, audienceGroupId, ... }
scaleCampaigns.post("/", async (c) => {
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
  if (!name) return c.json({ error: "Campaign name is required" }, 400);
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
  const baseSlug = slugifyCampaign(body.slug?.trim() || name) || newId("broadcast").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (data.campaigns.some((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const id = newId("broadcast");
  const now = new Date().toISOString();
  let created: Campaign | null = null;
  store.update((draft) => {
    const messageTemplate = createMessageTemplate(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name,
        category: "marketing",
        layoutId: body.defaultTemplateId || "tpl-minimal",
      },
      now,
    );
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
      templateId: messageTemplate.id,
      listStatus: "active",
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      startedAt: null,
      finishedAt: null,
      targetFilter: undefined,
      stats: emptyCampaignStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.campaigns.push(created);
  });

  return c.json(serializeCampaign(created!), 201);
});

scaleCampaigns.route("/:campaignId/audience", scaleCampaignAudience);

// GET /scale/campaigns/:id
scaleCampaigns.get("/:id", (c) => {
  const row = findCampaign(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serializeCampaign(row));
});

// PATCH /scale/campaigns/:id
scaleCampaigns.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = findCampaign(id);
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
    templateVariables?: Record<string, string>;
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
    body.templateId !== undefined ||
    body.templateVariables !== undefined;

  if (contentTouched && existing.status !== "draft") {
    return c.json({ error: "sent broadcasts are locked — duplicate as a new draft to edit" }, 409);
  }

  if (body.listStatus === "archived" && existing.listStatus !== "archived") {
    const sending = store.read().campaigns.find((b) => b.id === id && b.status === "sending");
    if (sending) {
      const sendingMessage = requireMessage(store.read(), sending.templateId);
      return c.json(
        {
          error: `Cannot archive broadcast while '${sendingMessage.subject || sending.name}' is currently sending.`,
        },
        409,
      );
    }
  }

  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;

  const now = new Date().toISOString();
  let updated: Campaign | null = null;
  store.update((draft) => {
    if (domainPatch) {
      draft.account.domain = domainPatch;
      if (workerUrl) draft.account.workerUrl = workerUrl;
    }
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const prev = draft.campaigns[idx]!;
    patchMessageTemplate(
      draft,
      prev.templateId,
      {
        name: body.name?.trim(),
        subject: body.subject,
        previewText: body.previewText,
        bodyMarkdown: body.bodyMarkdown,
        layoutId:
          body.templateId !== undefined
            ? body.templateId
            : body.defaultTemplateId !== undefined
              ? body.defaultTemplateId
              : undefined,
        templateVariables:
          body.templateVariables !== undefined
            ? sanitizeTemplateVariables(body.templateVariables)
            : undefined,
      },
      now,
    );
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
    draft.campaigns[idx] = {
      ...prev,
      audienceGroupId: nextAudienceGroupId,
      name: body.name?.trim() || prev.name,
      slug: body.slug?.trim() ? slugifyCampaign(body.slug) : prev.slug,
      description: body.description !== undefined ? body.description : prev.description,
      domain: domainPatch ?? prev.domain,
      fromName: body.fromName !== undefined ? body.fromName?.trim() || null : prev.fromName,
      fromEmail: resolvedFromEmail,
      replyTo: body.replyTo !== undefined ? body.replyTo?.trim() || null : prev.replyTo,
      complianceIdentityId:
        body.complianceIdentityId !== undefined
          ? body.complianceIdentityId?.trim() || null
          : prev.complianceIdentityId ?? null,
      listStatus: body.listStatus ?? prev.listStatus,
      updatedAt: now,
    };
    updated = draft.campaigns[idx]!;

    if (body.listStatus === "archived" && prev.listStatus !== "archived" && prev.status === "scheduled") {
      draft.scheduledJobs = draft.scheduledJobs.filter(
        (j) => !(j.kind === "campaign" && j.refId === id && j.status === "pending"),
      );
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        status: "draft",
        scheduledAt: null,
      };
    }
  });

  return c.json(serializeCampaign(updated!));
});

scaleCampaigns.post("/:id/test-send", async (c) => {
  const broadcast = findCampaign(c.req.param("id")!);
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
  if (!broadcast.fromEmail?.trim()) {
    return c.json({ error: "Set From email on Settings before sending a test." }, 400);
  }

  const sendAuth = resolveWorkerSendCredentials();
  if (!sendAuth.ok) {
    return c.json({ error: sendAuth.error }, 502);
  }

  const message = requireMessage(store.read(), broadcast.templateId);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml = getCampaignLayoutHtml(layoutId) ?? "<div>{{content}}</div>";
  const unsubscribeToken = resolveTestSendUnsubscribeToken(broadcast, to);
  const html = renderCampaignForRecipient({
    broadcastId: broadcast.id,
    recipientId: "test",
    bodyMarkdown: message.bodyMarkdown,
    templateId: layoutId,
    templateHtml,
    templateVariablesSchema: getCampaignLayoutSchema(layoutId),
    templateVariables: message.templateVariables ?? {},
    recipient: { email: to, name: "Test Recipient" },
    unsubscribeToken,
    scaleBaseUrl: SCALE_PUBLIC_BASE_URL,
  });
  const listUnsubscribeUrl = buildListUnsubscribeUrl(
    SCALE_PUBLIC_BASE_URL,
    broadcast.id,
    unsubscribeToken,
  );
  const result = await sendMail({
    to,
    from: broadcast.fromEmail.trim(),
    fromName: broadcast.fromName,
    replyTo: broadcast.replyTo,
    subject: `[Test] ${message.subject}`,
    html,
    listUnsubscribeUrl,
  });
  if (!result.ok) {
    return c.json({ error: result.error || "Worker rejected test send" }, 502);
  }
  return c.json({ ok: true });
});

scaleCampaigns.post("/:id/send", async (c) => {
  const id = c.req.param("id")!;
  const existing = findCampaign(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft") {
    if (existing.status === "sending") {
      return c.json({ error: "Campaign is already sending" }, 409);
    }
    return c.json({ error: `cannot send from status "${existing.status}"` }, 409);
  }
  const existingMessage = requireMessage(store.read(), existing.templateId);
  if (!existingMessage.subject.trim()) {
    return c.json({ error: "Subject is required before sending. Enter a subject in the Content tab." }, 400);
  }
  if (!existing.fromEmail?.trim()) {
    return c.json({ error: "Set From email on Settings before sending." }, 400);
  }

  const sendAuth = resolveWorkerSendCredentials();
  if (!sendAuth.ok) {
    return c.json({ error: sendAuth.error }, 502);
  }

  const members = resolveActiveAudienceContacts(existing);
  if (members.length === 0) {
    return c.json(
      { error: "Cannot send: this broadcast has 0 active audience contacts in the linked group." },
      400,
    );
  }

  const broadcast = claimCampaignForSend(id);
  if (!broadcast) {
    return c.json({ error: "Campaign is already sending or no longer a draft" }, 409);
  }

  const result = await dispatchCampaignToAudience(broadcast, members);
  const row = store.read().campaigns.find((r) => r.id === id)!;
  return c.json({ campaign: serializeCampaign(row), ...result });
});

scaleCampaigns.post("/:id/schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findCampaign(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "draft") {
    return c.json({ error: `cannot schedule from status "${broadcast.status}"` }, 409);
  }
  const scheduleMessage = requireMessage(store.read(), broadcast.templateId);
  if (!scheduleMessage.subject.trim()) {
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
      kind: "campaign",
      refId: id,
      runAt,
      status: "pending",
      createdAt: now,
    });
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        status: "scheduled",
        scheduledAt: runAt,
        updatedAt: now,
      };
    }
  });

  return c.json(serializeCampaign(store.read().campaigns.find((r) => r.id === id)!));
});

scaleCampaigns.post("/:id/cancel-schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findCampaign(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "scheduled") {
    return c.json({ error: "Cannot cancel: Campaign dispatch has already begun." }, 409);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    draft.scheduledJobs = draft.scheduledJobs.filter(
      (j) => !(j.kind === "campaign" && j.refId === id && j.status === "pending"),
    );
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        status: "draft",
        scheduledAt: null,
        updatedAt: now,
      };
    }
  });

  return c.json(serializeCampaign(store.read().campaigns.find((r) => r.id === id)!));
});

scaleCampaigns.post("/:id/duplicate", (c) => {
  const source = findCampaign(c.req.param("id")!);
  if (!source) return c.json({ error: "not found" }, 404);

  const id = newId("broadcast");
  const now = new Date().toISOString();
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (store.read().campaigns.some((b) => b.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  let created: Campaign | null = null;
  store.update((draft) => {
    const sourceMessage = requireMessage(draft, source.templateId);
    const messageTemplate = createMessageTemplate(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: `${source.name} (copy)`,
        category: "marketing",
        layoutId: sourceMessage.layoutId,
      },
      now,
    );
    patchMessageTemplate(
      draft,
      messageTemplate.id,
      {
        subject: sourceMessage.subject,
        previewText: sourceMessage.previewText,
        bodyMarkdown: sourceMessage.bodyMarkdown,
        templateVariables: sourceMessage.templateVariables,
      },
      now,
    );
    created = {
      ...source,
      id,
      name: `${source.name} (copy)`,
      slug,
      templateId: messageTemplate.id,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      startedAt: null,
      finishedAt: null,
      stats: emptyCampaignStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.campaigns.push(created);
  });

  return c.json(serializeCampaign(created!), 201);
});

scaleCampaigns.get("/:id/stats", (c) => {
  const id = c.req.param("id")!;
  const broadcast = findCampaign(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);

  const data = store.read();
  const recipients = data.recipients
    .filter((r) => r.campaignId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const trackingEvents = data.trackingEvents
    .filter((e) => e.campaignId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const dispatch =
    broadcast.status === "sending"
      ? buildCampaignDispatchProgress({
          recipients,
          startedAt: broadcast.startedAt ?? broadcast.sentAt ?? null,
        })
      : null;

  return c.json({
    campaign: serializeCampaign(broadcast),
    dispatch,
    trackingEvents: trackingEvents.map((e) => ({
      id: e.id,
      recipientId: e.recipientId,
      memberEmail: e.memberEmail,
      type: e.type,
      url: e.url ?? null,
      reason: e.reason ?? null,
      occurredAt: e.occurredAt,
    })),
    linkClicks: aggregateCampaignLinkClicks(id),
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
