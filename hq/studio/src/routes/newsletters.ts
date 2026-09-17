import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Newsletter } from "../db/types";
import { isValidEmail } from "../lib/shared/email";
import { claimNewsletterForSend, resolveTestSendUnsubscribeToken } from "../lib/newsletters/send-claim";
import { sanitizeTemplateVariables } from "../lib/templates/variable-schema";
import { createMessageForOwner, patchMessage } from "../lib/messages/message";
import { requireMessage } from "../lib/messages/resolve";
import { resolveActiveSubscriberContacts } from "../lib/subscriber-groups/resolver";
import { findSubscriberGroup } from "../lib/subscriber-groups/group";
import { dispatchNewsletterToSubscribers } from "../lib/newsletters/dispatch";
import { resolveWorkerSendCredentials } from "../lib/mail/credentials";
import { buildNewsletterDispatchProgress } from "../lib/newsletters/dispatch-progress";
import { aggregateNewsletterLinkClicks } from "../lib/newsletters/link-clicks";
import { buildNewsletterInProgressOverview, buildSentOverview } from "../lib/newsletters/overview";
import { slugifyNewsletter } from "../lib/newsletters/slug";
import {
  findNewsletter,
  getNewsletterLayoutHtml,
  getNewsletterLayoutSchema,
  serializeNewsletter,
} from "../lib/newsletters/serialize";
import { emptyNewsletterStats } from "../lib/newsletters/stats";
import { sendMail } from "../lib/mail/sender";
import {
  buildListUnsubscribeUrl,
  renderNewsletterForRecipient,
  resolveBroadcastSubject,
} from "../lib/render/render";
import { STUDIO_PUBLIC_BASE_URL } from "../lib/shared/studio-url";
import { newId, newToken } from "../lib/shared/ids";
import { studioNewsletterSubscribers } from "./newsletter-subscribers";

export const studioNewsletters = new Hono();

// GET /studio/broadcasts
studioNewsletters.get("/", (c) => {
  const rows = store
    .read()
    .newsletters.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ newsletters: rows.map(serializeNewsletter) });
});

studioNewsletters.get("/sent-stats", (c) => {
  const data = store.read();
  const subscriberNameById = new Map(data.subscriberGroups.map((g) => [g.id, g.name]));
  return c.json(
    buildSentOverview({
      newsletters: data.newsletters.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID),
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
      subscriberNameById,
    }),
  );
});

studioNewsletters.get("/in-progress", (c) => {
  const data = store.read();
  const mine = data.newsletters.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID);
  const sending = mine
    .filter((b) => b.status === "sending")
    .sort((a, b) => (b.startedAt ?? b.sentAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.sentAt ?? a.updatedAt))
    .map(serializeNewsletter);
  const scheduled = mine
    .filter((b) => b.status === "scheduled")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .map(serializeNewsletter);
  return c.json(
    buildNewsletterInProgressOverview({
      sending,
      scheduled,
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
    }),
  );
});

// POST /studio/broadcasts { name, subscriberGroupId, ... }
studioNewsletters.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    workerUrl?: string;
    subscriberGroupId?: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultLayoutId?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }

  const name = body.name?.trim();
  if (!name) return c.json({ error: "Newsletter name is required" }, 400);
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) return c.json({ error: "Select a sending domain for this broadcast" }, 400);
  const subscriberGroupId = body.subscriberGroupId?.trim();
  if (!subscriberGroupId) return c.json({ error: "Select a subscriber group for this broadcast" }, 400);
  const subscriberGroup = findSubscriberGroup(subscriberGroupId);
  if (!subscriberGroup) return c.json({ error: "Subscriber group not found" }, 404);
  if (subscriberGroup.domain.toLowerCase() !== domain) {
    return c.json({ error: "Subscriber group must belong to the selected domain" }, 400);
  }
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;
  store.update((draft) => {
    draft.account.domain = domain;
    if (workerUrl) draft.account.workerUrl = workerUrl;
  });
  if (body.fromEmail && !isValidEmail(body.fromEmail)) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  const data = store.read();
  const baseSlug = slugifyNewsletter(body.slug?.trim() || name) || newId("broadcast").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (data.newsletters.some((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const id = newId("broadcast");
  const now = new Date().toISOString();
  let created: Newsletter | null = null;
  store.update((draft) => {
    const message = createMessageForOwner(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name,
        layoutId: body.defaultLayoutId || "tpl-minimal",
      },
      now,
    );
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      slug,
      description: null,
      subscriberGroupId,
      domain,
      fromName: body.fromName?.trim() || null,
      fromEmail: body.fromEmail?.trim() || subscriberGroup.defaultFrom || null,
      replyTo: body.replyTo?.trim() || null,
      messageId: message.id,
      listStatus: "active",
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      startedAt: null,
      finishedAt: null,
      targetFilter: undefined,
      stats: emptyNewsletterStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.newsletters.push(created);
  });

  return c.json(serializeNewsletter(created!), 201);
});

studioNewsletters.route("/:newsletterId/subscribers", studioNewsletterSubscribers);

// GET /studio/newsletters/:id
studioNewsletters.get("/:id", (c) => {
  const row = findNewsletter(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serializeNewsletter(row));
});

// PATCH /studio/newsletters/:id
studioNewsletters.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = findNewsletter(id);
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
    complianceIdentityId?: string | null;
    listStatus?: "active" | "archived";
    subject?: string;
    previewText?: string;
    bodyMarkdown?: string;
    layoutId?: string | null;
    defaultLayoutId?: string | null;
    templateVariables?: Record<string, string>;
    subscriberGroupId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const subscriberGroupIdPatch =
    body.subscriberGroupId !== undefined ? body.subscriberGroupId.trim() : undefined;
  if (subscriberGroupIdPatch !== undefined) {
    if (existing.status !== "draft" && existing.status !== "scheduled") {
      return c.json({ error: "Subscriber list can only be changed before send" }, 409);
    }
    if (!subscriberGroupIdPatch) {
      return c.json({ error: "Select an subscriber group" }, 400);
    }
    const nextGroup = findSubscriberGroup(subscriberGroupIdPatch);
    if (!nextGroup) return c.json({ error: "Subscriber group not found" }, 404);
    const domainFromBody = body.domain?.trim().toLowerCase();
    const effectiveDomain = (
      domainFromBody ??
      existing.domain ??
      (existing.subscriberGroupId ? findSubscriberGroup(existing.subscriberGroupId)?.domain : "") ??
      ""
    ).toLowerCase();
    if (!effectiveDomain) {
      return c.json({ error: "Select a sending domain before linking a subscriber group" }, 400);
    }
    if (nextGroup.domain.toLowerCase() !== effectiveDomain) {
      return c.json(
        {
          error: `Subscriber group is on ${nextGroup.domain}. Choose a group on ${effectiveDomain}.`,
        },
        400,
      );
    }
  }

  if (body.fromEmail && !isValidEmail(body.fromEmail)) {
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
    const group = existing.subscriberGroupId ? findSubscriberGroup(existing.subscriberGroupId) : undefined;
    const prevDomain = (existing.domain || group?.domain || "").toLowerCase();
    const domainChanging = domainPatch !== prevDomain;
    if (domainChanging) {
      if (group && group.domain.toLowerCase() !== domainPatch) {
        return c.json(
          {
            error: `Subscriber group is on ${group.domain}. Choose that domain or change the linked subscriber group.`,
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
    body.layoutId !== undefined ||
    body.templateVariables !== undefined;

  if (contentTouched && existing.status !== "draft") {
    return c.json({ error: "sent broadcasts are locked — duplicate as a new draft to edit" }, 409);
  }

  if (body.listStatus === "archived" && existing.listStatus !== "archived") {
    const sending = store.read().newsletters.find((b) => b.id === id && b.status === "sending");
    if (sending) {
      const sendingMessage = requireMessage(store.read(), sending.messageId);
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
  let updated: Newsletter | null = null;
  store.update((draft) => {
    if (domainPatch) {
      draft.account.domain = domainPatch;
      if (workerUrl) draft.account.workerUrl = workerUrl;
    }
    const idx = draft.newsletters.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const prev = draft.newsletters[idx]!;
    patchMessage(
      draft,
      prev.messageId,
      {
        name: body.name?.trim(),
        subject: body.subject,
        previewText: body.previewText,
        bodyMarkdown: body.bodyMarkdown,
        layoutId:
          body.layoutId !== undefined
            ? body.layoutId
            : body.defaultLayoutId !== undefined
              ? body.defaultLayoutId
              : undefined,
        templateVariables:
          body.templateVariables !== undefined
            ? sanitizeTemplateVariables(body.templateVariables)
            : undefined,
      },
      now,
    );
    const prevGroup = prev.subscriberGroupId ? findSubscriberGroup(prev.subscriberGroupId) : undefined;
    const nextSubscriberGroupId =
      subscriberGroupIdPatch !== undefined ? subscriberGroupIdPatch : prev.subscriberGroupId;
    const nextGroup =
      subscriberGroupIdPatch !== undefined ? findSubscriberGroup(subscriberGroupIdPatch) : prevGroup;
    let nextFromEmail = prev.fromEmail;
    if (
      subscriberGroupIdPatch !== undefined &&
      nextGroup &&
      (!prev.fromEmail || prev.fromEmail === prevGroup?.defaultFrom)
    ) {
      nextFromEmail = nextGroup.defaultFrom ?? prev.fromEmail;
    }
    const resolvedFromEmail =
      body.fromEmail !== undefined ? body.fromEmail?.trim() || null : nextFromEmail;
    draft.newsletters[idx] = {
      ...prev,
      subscriberGroupId: nextSubscriberGroupId,
      name: body.name?.trim() || prev.name,
      slug: body.slug?.trim() ? slugifyNewsletter(body.slug) : prev.slug,
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
    updated = draft.newsletters[idx]!;

    if (body.listStatus === "archived" && prev.listStatus !== "archived" && prev.status === "scheduled") {
      draft.scheduledJobs = draft.scheduledJobs.filter(
        (j) => !(j.kind === "newsletter" && j.refId === id && j.status === "pending"),
      );
      draft.newsletters[idx] = {
        ...draft.newsletters[idx]!,
        status: "draft",
        scheduledAt: null,
      };
    }
  });

  return c.json(serializeNewsletter(updated!));
});

studioNewsletters.post("/:id/test-send", async (c) => {
  const broadcast = findNewsletter(c.req.param("id")!);
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

  const message = requireMessage(store.read(), broadcast.messageId);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml = getNewsletterLayoutHtml(layoutId) ?? "<div>{{content}}</div>";
  const unsubscribeToken = resolveTestSendUnsubscribeToken(broadcast, to);
  const html = renderNewsletterForRecipient({
    broadcastId: broadcast.id,
    recipientId: "test",
    bodyMarkdown: message.bodyMarkdown,
    templateId: layoutId,
    templateHtml,
    templateVariablesSchema: getNewsletterLayoutSchema(layoutId),
    templateVariables: message.templateVariables ?? {},
    recipient: { email: to, name: "Test Recipient" },
    unsubscribeToken,
    studioBaseUrl: STUDIO_PUBLIC_BASE_URL,
  });
  const listUnsubscribeUrl = buildListUnsubscribeUrl(
    STUDIO_PUBLIC_BASE_URL,
    broadcast.id,
    unsubscribeToken,
  );
  const resolvedSubject = resolveBroadcastSubject({
    subject: message.subject,
    templateVariablesSchema: getNewsletterLayoutSchema(layoutId),
    templateVariables: message.templateVariables ?? {},
    recipient: { email: to, name: "Test Recipient" },
    broadcastId: broadcast.id,
    unsubscribeToken,
    studioBaseUrl: STUDIO_PUBLIC_BASE_URL,
  });
  const result = await sendMail({
    to,
    from: broadcast.fromEmail.trim(),
    fromName: broadcast.fromName,
    replyTo: broadcast.replyTo,
    subject: `[Test] ${resolvedSubject}`,
    html,
    listUnsubscribeUrl,
  });
  if (!result.ok) {
    return c.json({ error: result.error || "Worker rejected test send" }, 502);
  }
  return c.json({ ok: true });
});

studioNewsletters.post("/:id/send", async (c) => {
  const id = c.req.param("id")!;
  const existing = findNewsletter(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft") {
    if (existing.status === "sending") {
      return c.json({ error: "Newsletter is already sending" }, 409);
    }
    return c.json({ error: `cannot send from status "${existing.status}"` }, 409);
  }
  const existingMessage = requireMessage(store.read(), existing.messageId);
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

  const members = resolveActiveSubscriberContacts(existing);
  if (members.length === 0) {
    return c.json(
      { error: "Cannot send: this broadcast has 0 active subscriber contacts in the linked group." },
      400,
    );
  }

  const broadcast = claimNewsletterForSend(id);
  if (!broadcast) {
    return c.json({ error: "Newsletter is already sending or no longer a draft" }, 409);
  }

  const result = await dispatchNewsletterToSubscribers(broadcast, members);
  const row = store.read().newsletters.find((r) => r.id === id)!;
  return c.json({ newsletter: serializeNewsletter(row), ...result });
});

studioNewsletters.post("/:id/schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findNewsletter(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "draft") {
    return c.json({ error: `cannot schedule from status "${broadcast.status}"` }, 409);
  }
  const scheduleMessage = requireMessage(store.read(), broadcast.messageId);
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
      kind: "newsletter",
      refId: id,
      runAt,
      status: "pending",
      createdAt: now,
    });
    const idx = draft.newsletters.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.newsletters[idx] = {
        ...draft.newsletters[idx]!,
        status: "scheduled",
        scheduledAt: runAt,
        updatedAt: now,
      };
    }
  });

  return c.json(serializeNewsletter(store.read().newsletters.find((r) => r.id === id)!));
});

studioNewsletters.post("/:id/cancel-schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = findNewsletter(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "scheduled") {
    return c.json({ error: "Cannot cancel: Newsletter dispatch has already begun." }, 409);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    draft.scheduledJobs = draft.scheduledJobs.filter(
      (j) => !(j.kind === "newsletter" && j.refId === id && j.status === "pending"),
    );
    const idx = draft.newsletters.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.newsletters[idx] = {
        ...draft.newsletters[idx]!,
        status: "draft",
        scheduledAt: null,
        updatedAt: now,
      };
    }
  });

  return c.json(serializeNewsletter(store.read().newsletters.find((r) => r.id === id)!));
});

studioNewsletters.post("/:id/duplicate", (c) => {
  const source = findNewsletter(c.req.param("id")!);
  if (!source) return c.json({ error: "not found" }, 404);

  const id = newId("broadcast");
  const now = new Date().toISOString();
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (store.read().newsletters.some((b) => b.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  let created: Newsletter | null = null;
  store.update((draft) => {
    const sourceMessage = requireMessage(draft, source.messageId);
    const message = createMessageForOwner(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: `${source.name} (copy)`,
        layoutId: sourceMessage.layoutId,
      },
      now,
    );
    patchMessage(
      draft,
      message.id,
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
      messageId: message.id,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      startedAt: null,
      finishedAt: null,
      stats: emptyNewsletterStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.newsletters.push(created);
  });

  return c.json(serializeNewsletter(created!), 201);
});

studioNewsletters.get("/:id/stats", (c) => {
  const id = c.req.param("id")!;
  const broadcast = findNewsletter(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);

  const data = store.read();
  const recipients = data.recipients
    .filter((r) => r.newsletterId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const trackingEvents = data.trackingEvents
    .filter((e) => e.newsletterId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const dispatch =
    broadcast.status === "sending"
      ? buildNewsletterDispatchProgress({
          recipients,
          startedAt: broadcast.startedAt ?? broadcast.sentAt ?? null,
        })
      : null;

  return c.json({
    newsletter: serializeNewsletter(broadcast),
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
    linkClicks: aggregateNewsletterLinkClicks(id),
    recipients: recipients.map((r) => ({
      id: r.id,
      subscriberMemberId: r.subscriberMemberId,
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
