import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Automation, AutomationPurpose, AutomationTrigger, InternalAutomationEvent } from "../db/types";
import { findAudienceGroup } from "../lib/audience-groups/group";
import { dispatchAutomationSend } from "../lib/automations/dispatch";
import { fireAutomation } from "../lib/automations/fire";
import { findAutomationByInternalEvent } from "../lib/automations/matcher";
import {
  findAutomation,
  serializeAutomation,
  serializeAutomationSend,
  serializeTriggerEvent,
} from "../lib/automations/serialize";
import { slugifyAutomation } from "../lib/automations/slug";
import { emptyAutomationStats, normalizeAutomationStats } from "../lib/automations/stats";
import { defaultHttpWebhookTrigger, defaultTriggerForPurpose } from "../lib/automations/trigger-defaults";
import { validateAutomationForActivation } from "../lib/automations/validate";
import { newId, newToken } from "../lib/shared/ids";

export const scaleAutomations = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function defaultFromForDomain(domain: string): string {
  return `hello@${domain}`;
}

function purposeFromInput(raw: string | undefined): AutomationPurpose {
  if (raw === "conversational" || raw === "marketing") return raw;
  return "transactional";
}

function mergeTriggerPatch(
  existing: AutomationTrigger,
  patch: Partial<AutomationTrigger> | AutomationTrigger | undefined,
): AutomationTrigger {
  if (!patch || typeof patch !== "object") return existing;
  if ("type" in patch && patch.type && patch.type !== existing.type) {
    return patch as AutomationTrigger;
  }
  return { ...existing, ...patch } as AutomationTrigger;
}

scaleAutomations.get("/", (c) => {
  const rows = store
    .read()
    .automations.filter((a) => a.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ automations: rows.map((row) => serializeAutomation(row)) });
});

scaleAutomations.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    purpose?: AutomationPurpose;
    triggerType?: AutomationTrigger["type"];
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }

  const name = body.name?.trim();
  if (!name) return c.json({ error: "Automation name is required" }, 400);
  const domain = body.domain?.trim().toLowerCase() || store.read().account.domain?.trim().toLowerCase();
  if (!domain) return c.json({ error: "Select a sending domain for this automation" }, 400);

  const purpose = purposeFromInput(body.purpose);
  let trigger: AutomationTrigger = defaultTriggerForPurpose(purpose);
  if (body.triggerType === "http_webhook") trigger = defaultHttpWebhookTrigger();
  if (body.triggerType === "mailbox_inbound") {
    trigger = {
      type: "mailbox_inbound",
      domain,
      localPart: "hello",
      replyToSender: true,
      match: null,
    };
  }

  const data = store.read();
  const baseSlug = slugifyAutomation(name) || newId("automation").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (data.automations.some((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const id = newId("automation");
  const now = new Date().toISOString();
  let created: Automation | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      slug,
      description: null,
      domain,
      fromName: draft.account.compliance.organizationName,
      fromEmail: defaultFromForDomain(domain),
      replyTo: draft.account.compliance.contactEmail,
      complianceIdentityId: draft.account.defaultComplianceIdentityId,
      purpose,
      listStatus: "active",
      status: "draft",
      trigger,
      audienceGroupId: null,
      cooldownSeconds: 86_400,
      applyMarketingSuppression: purpose !== "transactional",
      subject: "",
      previewText: null,
      bodyMarkdown: "",
      templateId: "tpl-minimal",
      templateVariables: {},
      stats: emptyAutomationStats(),
      lastTriggeredAt: null,
      lastSentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    draft.automations.push(created);
  });

  return c.json(serializeAutomation(created!, { revealTriggerSecret: true }), 201);
});

scaleAutomations.post("/fire/internal/:event", async (c) => {
  const event = c.req.param("event") as InternalAutomationEvent;
  if (event !== "account.verify_email" && event !== "account.created") {
    return c.json({ error: "unknown internal event" }, 400);
  }

  const automation = findAutomationByInternalEvent(event);
  if (!automation) {
    return c.json({ error: "no active automation for this event" }, 404);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await c.req.json()) as Record<string, unknown>;
  } catch {
    /* empty object ok */
  }

  const idempotencyKey = c.req.header("Idempotency-Key")?.trim() || null;
  const result = await fireAutomation({
    automation,
    triggerType: "internal_event",
    payload,
    idempotencyKey,
  });

  return c.json(result, result.skipReason && result.status === "skipped" ? 202 : 200);
});

scaleAutomations.get("/:id", (c) => {
  const row = findAutomation(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serializeAutomation(row));
});

scaleAutomations.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = findAutomation(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    slug?: string;
    description?: string | null;
    domain?: string;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
    complianceIdentityId?: string | null;
    listStatus?: "active" | "archived";
    purpose?: AutomationPurpose;
    trigger?: AutomationTrigger;
    audienceGroupId?: string | null;
    cooldownSeconds?: number;
    applyMarketingSuppression?: boolean;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    templateId?: string | null;
    templateVariables?: Record<string, string>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email" }, 400);
  }

  if (body.complianceIdentityId !== undefined && body.complianceIdentityId !== null) {
    const identityId = body.complianceIdentityId.trim();
    const exists = store.read().complianceIdentities.some((row) => row.id === identityId);
    if (!exists) return c.json({ error: "Compliance sender not found" }, 400);
  }

  if (body.audienceGroupId !== undefined && body.audienceGroupId !== null) {
    const group = findAudienceGroup(body.audienceGroupId.trim());
    if (!group) return c.json({ error: "Audience group not found" }, 404);
    const domain = (body.domain ?? existing.domain).toLowerCase();
    if (group.domain.toLowerCase() !== domain) {
      return c.json({ error: "Audience group domain must match automation domain" }, 400);
    }
  }

  const now = new Date().toISOString();
  let updated: Automation | null = null;
  store.update((draft) => {
    const idx = draft.automations.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const row = draft.automations[idx]!;
    const purpose = body.purpose ?? row.purpose;
    updated = {
      ...row,
      name: body.name?.trim() ?? row.name,
      slug: body.slug !== undefined ? slugifyAutomation(body.slug) || row.slug : row.slug,
      description: body.description !== undefined ? body.description : row.description,
      domain: body.domain?.trim().toLowerCase() ?? row.domain,
      fromName: body.fromName !== undefined ? body.fromName : row.fromName,
      fromEmail: body.fromEmail !== undefined ? body.fromEmail?.trim() || null : row.fromEmail,
      replyTo: body.replyTo !== undefined ? body.replyTo : row.replyTo,
      complianceIdentityId:
        body.complianceIdentityId !== undefined
          ? body.complianceIdentityId
          : row.complianceIdentityId,
      listStatus: body.listStatus ?? row.listStatus,
      purpose,
      trigger: body.trigger ? mergeTriggerPatch(row.trigger, body.trigger) : row.trigger,
      audienceGroupId:
        body.audienceGroupId !== undefined ? body.audienceGroupId : row.audienceGroupId,
      cooldownSeconds:
        body.cooldownSeconds !== undefined ? Math.max(0, body.cooldownSeconds) : row.cooldownSeconds,
      applyMarketingSuppression:
        body.applyMarketingSuppression !== undefined
          ? body.applyMarketingSuppression
          : purpose !== "transactional",
      subject: body.subject !== undefined ? body.subject : row.subject,
      previewText: body.previewText !== undefined ? body.previewText : row.previewText,
      bodyMarkdown: body.bodyMarkdown !== undefined ? body.bodyMarkdown : row.bodyMarkdown,
      templateId: body.templateId !== undefined ? body.templateId : row.templateId,
      templateVariables:
        body.templateVariables !== undefined
          ? sanitizeTemplateVariables(body.templateVariables)
          : row.templateVariables,
      updatedAt: now,
    };
    draft.automations[idx] = updated;
  });

  return c.json(serializeAutomation(updated!));
});

scaleAutomations.post("/:id/activate", (c) => {
  const id = c.req.param("id")!;
  const existing = findAutomation(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const issues = validateAutomationForActivation(existing);
  if (issues.length) {
    return c.json({ error: "cannot activate", issues }, 422);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.automations.findIndex((a) => a.id === id);
    if (idx < 0) return;
    draft.automations[idx] = {
      ...draft.automations[idx]!,
      status: "active",
      updatedAt: now,
    };
  });

  return c.json(serializeAutomation(findAutomation(id)!));
});

scaleAutomations.post("/:id/pause", (c) => {
  const id = c.req.param("id")!;
  const existing = findAutomation(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.automations.findIndex((a) => a.id === id);
    if (idx < 0) return;
    draft.automations[idx] = {
      ...draft.automations[idx]!,
      status: "paused",
      updatedAt: now,
    };
  });

  return c.json(serializeAutomation(findAutomation(id)!));
});

scaleAutomations.post("/:id/rotate-webhook-secret", (c) => {
  const id = c.req.param("id")!;
  const existing = findAutomation(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.trigger.type !== "http_webhook") {
    return c.json({ error: "automation is not http_webhook" }, 409);
  }

  const secret = newToken();
  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.automations.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const trigger = draft.automations[idx]!.trigger;
    if (trigger.type !== "http_webhook") return;
    draft.automations[idx] = {
      ...draft.automations[idx]!,
      trigger: { ...trigger, secret },
      updatedAt: now,
    };
  });

  return c.json({
    automation: serializeAutomation(findAutomation(id)!, { revealTriggerSecret: true }),
    secret,
  });
});

scaleAutomations.post("/:id/test-send", async (c) => {
  const id = c.req.param("id")!;
  const existing = findAutomation(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: { email?: string; name?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "valid test email is required" }, 400);
  }

  const payload: Record<string, unknown> = {
    email,
    name: body.name?.trim() || "Test User",
    verifyUrl: "https://example.com/verify?token=test",
    message: "This is a test message from Scale automations.",
    ...(body.payload ?? {}),
  };

  const sendId = newId("autosend");
  const triggerEventId = newId("triggerevent");
  const now = new Date().toISOString();

  store.update((draft) => {
    draft.triggerEvents.push({
      id: triggerEventId,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      automationId: id,
      triggerType: existing.trigger.type,
      idempotencyKey: `test_${now}_${email}`,
      recipientEmail: email,
      recipientName: payload.name as string,
      payload,
      status: "queued",
      skipReason: null,
      occurredAt: now,
    });
    draft.automationSends.push({
      id: sendId,
      automationId: id,
      triggerEventId,
      audienceMemberId: null,
      email,
      name: (payload.name as string) ?? null,
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
  });

  const automation = findAutomation(id)!;
  const send = store.read().automationSends.find((s) => s.id === sendId)!;
  const result = await dispatchAutomationSend(automation, send, payload);
  if (!result.ok) {
    return c.json({ error: result.error, automationSendId: sendId }, 502);
  }

  return c.json({ ok: true, automationSendId: sendId, triggerEventId });
});

scaleAutomations.get("/:id/activity", (c) => {
  const id = c.req.param("id")!;
  if (!findAutomation(id)) return c.json({ error: "not found" }, 404);

  const data = store.read();
  const events = data.triggerEvents
    .filter((e) => e.automationId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map(serializeTriggerEvent);
  const sends = data.automationSends
    .filter((s) => s.automationId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(serializeAutomationSend);

  return c.json({ triggerEvents: events, sends });
});

scaleAutomations.get("/:id/stats", (c) => {
  const row = findAutomation(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({
    automationId: row.id,
    stats: normalizeAutomationStats(row.stats),
    lastTriggeredAt: row.lastTriggeredAt ?? null,
    lastSentAt: row.lastSentAt ?? null,
  });
});
