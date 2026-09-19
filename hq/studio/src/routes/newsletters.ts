import {
  DEV_ACCOUNT_LINK_ID,
  messageService,
  newsletterService,
  studioDocumentService,
  subscriberGroupService,
  templateService,
} from "@services/index";
import {
  buildListUnsubscribeUrl,
  renderNewsletterForRecipient,
  resolveBroadcastSubject,
} from "@lib/render/render";

import { Hono } from "hono";
import type { Newsletter } from "@db/types";
import { STUDIO_PUBLIC_BASE_URL } from "@lib/shared/studio-url";
import { isValidEmail } from "@lib/shared/email";
import { newId } from "@lib/shared/ids";
import { resolveWorkerSendCredentials } from "@lib/mail/credentials";
import { sendMail } from "@lib/mail/sender";
import { studioNewsletterSubscribers } from "@/routes/newsletter-subscribers";
export const studioNewsletters = new Hono();

// GET /studio/broadcasts
studioNewsletters.get("/", (c) => {
  const rows = studioDocumentService.read()
    .newsletters.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ newsletters: rows.map((row) => newsletterService.serialize(row)) });
});

studioNewsletters.get("/sent-stats", (c) => {
  const data = studioDocumentService.read();
  const subscriberNameById = new Map(data.subscriberGroups.map((g) => [g.id, g.name]));
  return c.json(
    newsletterService.buildSentOverview({
      newsletters: data.newsletters.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID),
      recipients: data.recipients,
      trackingEvents: data.trackingEvents,
      subscriberNameById,
    }),
  );
});

studioNewsletters.get("/in-progress", (c) => {
  const data = studioDocumentService.read();
  const mine = data.newsletters.filter((b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID);
  const sending = mine
    .filter((b) => b.status === "sending")
    .sort((a, b) => (b.startedAt ?? b.sentAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.sentAt ?? a.updatedAt))
    .map((row) => newsletterService.serialize(row));
  const scheduled = mine
    .filter((b) => b.status === "scheduled")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .map((row) => newsletterService.serialize(row));
  return c.json(
    newsletterService.buildInProgressOverview({
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

  const subscriberGroupId = body.subscriberGroupId?.trim() || "";
  let domain = body.domain?.trim().toLowerCase() || "";
  let subscriberGroup = subscriberGroupId ? subscriberGroupService.findGroup(subscriberGroupId) : undefined;
  if (subscriberGroupId && !subscriberGroup) {
    return c.json({ error: "Subscriber group not found" }, 404);
  }
  if (subscriberGroup) {
    if (!domain) domain = subscriberGroup.domain.toLowerCase();
    if (subscriberGroup.domain.toLowerCase() !== domain) {
      return c.json({ error: "Subscriber group must belong to the selected domain" }, 400);
    }
  } else if (!domain) {
    domain = studioDocumentService.read().account.domain?.trim().toLowerCase() || "";
  }
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;
  studioDocumentService.mutate((draft) => {
    if (domain) draft.account.domain = domain;
    if (workerUrl) draft.account.workerUrl = workerUrl;
  });
  if (body.fromEmail && !isValidEmail(body.fromEmail)) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  const id = newId("newsletter");
  const data = studioDocumentService.read();
  const baseSlug =
    newsletterService.slugify(body.slug?.trim() || "") ||
    id.replace(/^newsletter_/, "").slice(0, 12) ||
    newId("newsletter").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (data.newsletters.some((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  const now = new Date().toISOString();
  let created: Newsletter | null = null;
  studioDocumentService.mutate((draft) => {
    const message = messageService.createForOwner(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: "",
        layoutId: body.defaultLayoutId || "tpl-minimal",
      },
      now,
    );
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      slug,
      description: null,
      subscriberGroupId,
      domain,
      fromName: body.fromName?.trim() || null,
      fromEmail: body.fromEmail?.trim() || subscriberGroup?.defaultFrom || null,
      replyTo: body.replyTo?.trim() || null,
      messageId: message.id,
      listStatus: "active",
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      startedAt: null,
      finishedAt: null,
      targetFilter: undefined,
      stats: newsletterService.emptyStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.newsletters.push(created);
  });

  return c.json(newsletterService.serialize(created!), 201);
});

studioNewsletters.route("/:newsletterId/subscribers", studioNewsletterSubscribers);

// GET /studio/newsletters/:id
studioNewsletters.get("/:id", (c) => {
  const row = newsletterService.findInDocument(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(newsletterService.serialize(row));
});

// PATCH /studio/newsletters/:id
studioNewsletters.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = newsletterService.findInDocument(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
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
    const nextGroup = subscriberGroupService.findGroup(subscriberGroupIdPatch);
    if (!nextGroup) return c.json({ error: "Subscriber group not found" }, 404);
    const domainFromBody = body.domain?.trim().toLowerCase();
    const effectiveDomain = (
      domainFromBody ??
      existing.domain ??
      (existing.subscriberGroupId ? subscriberGroupService.findGroup(existing.subscriberGroupId)?.domain : "") ??
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
    const exists = studioDocumentService.read().complianceIdentities.some((row) => row.id === identityId);
    if (!exists) return c.json({ error: "Compliance sender not found" }, 400);
  }

  const domainPatch = body.domain?.trim().toLowerCase();
  if (domainPatch !== undefined) {
    if (!domainPatch) {
      return c.json({ error: "Select a sending domain" }, 400);
    }
    const group = existing.subscriberGroupId ? subscriberGroupService.findGroup(existing.subscriberGroupId) : undefined;
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
    const sending = studioDocumentService.read().newsletters.find((b) => b.id === id && b.status === "sending");
    if (sending) {
      const sendingMessage = messageService.requireMessage(studioDocumentService.read(), sending.messageId);
      return c.json(
        {
          error: `Cannot archive broadcast while '${sendingMessage.subject || "a newsletter"}' is currently sending.`,
        },
        409,
      );
    }
  }

  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;

  const now = new Date().toISOString();
  let updated: Newsletter | null = null;
  studioDocumentService.mutate((draft) => {
    if (domainPatch) {
      draft.account.domain = domainPatch;
      if (workerUrl) draft.account.workerUrl = workerUrl;
    }
    const idx = draft.newsletters.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const prev = draft.newsletters[idx]!;
    messageService.patch(
      draft,
      prev.messageId,
      {
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
            ? templateService.sanitizeVariables(body.templateVariables)
            : undefined,
      },
      now,
    );
    const prevGroup = prev.subscriberGroupId ? subscriberGroupService.findGroup(prev.subscriberGroupId) : undefined;
    const nextSubscriberGroupId =
      subscriberGroupIdPatch !== undefined ? subscriberGroupIdPatch : prev.subscriberGroupId;
    const nextGroup =
      subscriberGroupIdPatch !== undefined ? subscriberGroupService.findGroup(subscriberGroupIdPatch) : prevGroup;
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
      slug: body.slug?.trim() ? newsletterService.slugify(body.slug) : prev.slug,
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

  return c.json(newsletterService.serialize(updated!));
});

studioNewsletters.post("/:id/test-send", async (c) => {
  const broadcast = newsletterService.findInDocument(c.req.param("id")!);
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

  const message = messageService.requireMessage(studioDocumentService.read(), broadcast.messageId);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml = newsletterService.layoutHtml(layoutId) ?? "<div>{{content}}</div>";
  const unsubscribeToken = newsletterService.resolveTestSendUnsubscribeToken(broadcast, to);
  const html = renderNewsletterForRecipient({
    broadcastId: broadcast.id,
    recipientId: "test",
    bodyMarkdown: message.bodyMarkdown,
    templateId: layoutId,
    templateHtml,
    templateVariablesSchema: newsletterService.layoutSchema(layoutId),
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
    templateVariablesSchema: newsletterService.layoutSchema(layoutId),
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
  const existing = newsletterService.findInDocument(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft") {
    if (existing.status === "sending") {
      return c.json({ error: "Newsletter is already sending" }, 409);
    }
    return c.json({ error: `cannot send from status "${existing.status}"` }, 409);
  }
  const existingMessage = messageService.requireMessage(studioDocumentService.read(), existing.messageId);
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

  const members = subscriberGroupService.resolveActiveContacts(existing);
  if (members.length === 0) {
    return c.json(
      { error: "Cannot send: this broadcast has 0 active subscriber contacts in the linked group." },
      400,
    );
  }

  const broadcast = newsletterService.claimForSend(id);
  if (!broadcast) {
    return c.json({ error: "Newsletter is already sending or no longer a draft" }, 409);
  }

  const result = await newsletterService.dispatchToSubscribers(broadcast, members);
  const row = studioDocumentService.read().newsletters.find((r) => r.id === id)!;
  return c.json({ newsletter: newsletterService.serialize(row), ...result });
});

studioNewsletters.post("/:id/schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = newsletterService.findInDocument(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "draft") {
    return c.json({ error: `cannot schedule from status "${broadcast.status}"` }, 409);
  }
  const scheduleMessage = messageService.requireMessage(studioDocumentService.read(), broadcast.messageId);
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
  studioDocumentService.mutate((draft) => {
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

  return c.json(newsletterService.serialize(studioDocumentService.read().newsletters.find((r) => r.id === id)!));
});

studioNewsletters.post("/:id/cancel-schedule", async (c) => {
  const id = c.req.param("id")!;
  const broadcast = newsletterService.findInDocument(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);
  if (broadcast.status !== "scheduled") {
    return c.json({ error: "Cannot cancel: Newsletter dispatch has already begun." }, 409);
  }

  const now = new Date().toISOString();
  studioDocumentService.mutate((draft) => {
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

  return c.json(newsletterService.serialize(studioDocumentService.read().newsletters.find((r) => r.id === id)!));
});

studioNewsletters.post("/:id/duplicate", (c) => {
  const source = newsletterService.findInDocument(c.req.param("id")!);
  if (!source) return c.json({ error: "not found" }, 404);

  const id = newId("newsletter");
  const now = new Date().toISOString();
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (studioDocumentService.read().newsletters.some((b) => b.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  let created: Newsletter | null = null;
  studioDocumentService.mutate((draft) => {
    const sourceMessage = messageService.requireMessage(draft, source.messageId);
    const message = messageService.createForOwner(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: "",
        layoutId: sourceMessage.layoutId,
      },
      now,
    );
    messageService.patch(
      draft,
      message.id,
      {
        subject: sourceMessage.subject.trim()
          ? `${sourceMessage.subject} (copy)`
          : sourceMessage.subject,
        previewText: sourceMessage.previewText,
        bodyMarkdown: sourceMessage.bodyMarkdown,
        templateVariables: sourceMessage.templateVariables,
      },
      now,
    );
    created = {
      ...source,
      id,
      slug,
      messageId: message.id,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      startedAt: null,
      finishedAt: null,
      stats: newsletterService.emptyStats(),
      createdAt: now,
      updatedAt: now,
    };
    draft.newsletters.push(created);
  });

  return c.json(newsletterService.serialize(created!), 201);
});

studioNewsletters.get("/:id/stats", (c) => {
  const id = c.req.param("id")!;
  const broadcast = newsletterService.findInDocument(id);
  if (!broadcast) return c.json({ error: "not found" }, 404);

  const data = studioDocumentService.read();
  const recipients = data.recipients
    .filter((r) => r.newsletterId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const trackingEvents = data.trackingEvents
    .filter((e) => e.newsletterId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const dispatch =
    broadcast.status === "sending"
      ? newsletterService.dispatchProgress({
          recipients,
          startedAt: broadcast.startedAt ?? broadcast.sentAt ?? null,
        })
      : null;

  return c.json({
    newsletter: newsletterService.serialize(broadcast),
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
    linkClicks: newsletterService.linkClickAggregate(id),
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
