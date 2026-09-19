import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, studioService } from "@services/studio-service";
import type { TriggerPurpose, Trigger, TriggerSource } from "@db/types";
import { createMessageForOwner, patchMessage } from "@lib/messages/message";
import { triggerSource } from "@lib/messages/resolve";
import { findSubscriberGroup } from "@lib/subscriber-groups/group";
import { dispatchTriggerSend } from "@lib/triggers/dispatch";
import { fireTrigger } from "@lib/triggers/fire";
import {
  findTrigger,
  serializeTrigger,
  serializeTriggerSend,
  serializeTriggerEvent,
} from "@lib/triggers/serialize";
import { slugifyTrigger } from "@lib/triggers/slug";
import { emptyTriggerStats, normalizeTriggerStats } from "@lib/triggers/stats";
import {
  defaultHttpWebhookTrigger,
  defaultMailboxInboundTrigger,
  defaultTriggerForPurpose,
} from "@lib/triggers/trigger-defaults";
import { buildTriggerStatsOverview } from "@lib/triggers/trigger-stats-overview";
import { validateTriggerForActivation } from "@lib/triggers/validate";
import {
  defaultFromForDomain,
  mergeTriggerPatch,
  purposeFromInput,
} from "@lib/triggers/patch";
import { sanitizeTemplateVariables } from "@lib/templates/variable-schema";
import { isValidEmail } from "@lib/shared/email";
import { newId, newToken } from "@lib/shared/ids";

export const studioTriggers = new Hono();

studioTriggers.get("/", (c) => {
  const rows = studioService
    .read()
    .triggers.filter((a) => a.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ triggers: rows.map((row) => serializeTrigger(row)) });
});

studioTriggers.get("/stats", (c) => {
  return c.json(buildTriggerStatsOverview());
});

studioTriggers.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    purpose?: TriggerPurpose;
    triggerType?: TriggerSource["type"];
    sourceType?: TriggerSource["type"];
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }

  const name = body.name?.trim();
  if (!name) return c.json({ error: "Trigger name is required" }, 400);
  const domain = body.domain?.trim().toLowerCase() || studioService.read().account.domain?.trim().toLowerCase();
  if (!domain) return c.json({ error: "Select a sending domain for this automation" }, 400);

  const purpose = purposeFromInput(body.purpose);
  const requestedType = body.triggerType || body.sourceType;
  let source: TriggerSource;
  if (requestedType === "mailbox_inbound" || (!requestedType && purpose === "conversational")) {
    source = defaultMailboxInboundTrigger(domain, "support");
  } else {
    source = defaultHttpWebhookTrigger();
  }

  const data = studioService.read();
  const baseSlug = slugifyTrigger(name) || newId("automation").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (data.triggers.some((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const id = newId("automation");
  const now = new Date().toISOString();
  let created: Trigger | null = null;
  studioService.update((draft) => {
    const message = createMessageForOwner(
      draft,
      {
        ownerId: id,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name,
        layoutId: "tpl-minimal",
      },
      now,
    );
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      slug,
      description: null,
      domain,
      fromName: draft.account.compliance.organizationName,
      fromEmail: defaultFromForDomain(domain),
      replyTo: null,
      complianceIdentityId: draft.account.defaultComplianceIdentityId,
      purpose,
      listStatus: "active",
      status: "draft",
      source,
      subscriberGroupId: null,
      cooldownSeconds: source.type === "mailbox_inbound" ? 3600 : 86_400,
      applyMarketingSuppression: purpose !== "transactional",
      messageId: message.id,
      stats: emptyTriggerStats(),
      lastTriggeredAt: null,
      lastSentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    draft.triggers.push(created);
  });

  return c.json(serializeTrigger(created!, { revealTriggerSecret: true }), 201);
});

studioTriggers.get("/:id", (c) => {
  const row = findTrigger(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serializeTrigger(row));
});

studioTriggers.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const existing = findTrigger(id);
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
    purpose?: TriggerPurpose;
    source?: TriggerSource;
    subscriberGroupId?: string | null;
    cooldownSeconds?: number;
    applyMarketingSuppression?: boolean;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    templateVariables?: Record<string, string>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (body.fromEmail && !isValidEmail(body.fromEmail)) {
    return c.json({ error: "Enter a valid sender email" }, 400);
  }

  if (body.complianceIdentityId !== undefined && body.complianceIdentityId !== null) {
    const identityId = body.complianceIdentityId.trim();
    const exists = studioService.read().complianceIdentities.some((row) => row.id === identityId);
    if (!exists) return c.json({ error: "Compliance sender not found" }, 400);
  }

  if (body.subscriberGroupId !== undefined && body.subscriberGroupId !== null) {
    const group = findSubscriberGroup(body.subscriberGroupId.trim());
    if (!group) return c.json({ error: "Subscriber group not found" }, 404);
    const domain = (body.domain ?? existing.domain).toLowerCase();
    if (group.domain.toLowerCase() !== domain) {
      return c.json({ error: "Subscriber group domain must match automation domain" }, 400);
    }
  }

  const now = new Date().toISOString();
  let updated: Trigger | null = null;
  studioService.update((draft) => {
    const idx = draft.triggers.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const row = draft.triggers[idx]!;
    const purpose = body.purpose ?? row.purpose;
    const existingSource = triggerSource(row);
    patchMessage(
      draft,
      row.messageId,
      {
        name: body.name?.trim(),
        subject: body.subject,
        previewText: body.previewText,
        bodyMarkdown: body.bodyMarkdown,
        layoutId: body.layoutId !== undefined ? body.layoutId : undefined,
        templateVariables:
          body.templateVariables !== undefined
            ? sanitizeTemplateVariables(body.templateVariables)
            : undefined,
      },
      now,
    );
    updated = {
      ...row,
      name: body.name?.trim() ?? row.name,
      slug: body.slug !== undefined ? slugifyTrigger(body.slug) || row.slug : row.slug,
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
      source: body.source ? mergeTriggerPatch(existingSource, body.source) : existingSource,
      subscriberGroupId:
        body.subscriberGroupId !== undefined ? body.subscriberGroupId : row.subscriberGroupId,
      cooldownSeconds:
        body.cooldownSeconds !== undefined ? Math.max(0, body.cooldownSeconds) : row.cooldownSeconds,
      applyMarketingSuppression:
        body.applyMarketingSuppression !== undefined
          ? body.applyMarketingSuppression
          : purpose !== "transactional",
      updatedAt: now,
    };
    draft.triggers[idx] = updated;
  });

  return c.json(serializeTrigger(updated!));
});

studioTriggers.post("/:id/activate", (c) => {
  const id = c.req.param("id")!;
  const existing = findTrigger(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const issues = validateTriggerForActivation(existing);
  if (issues.length) {
    return c.json({ error: "cannot activate", issues }, 422);
  }

  const now = new Date().toISOString();
  studioService.update((draft) => {
    const idx = draft.triggers.findIndex((a) => a.id === id);
    if (idx < 0) return;
    draft.triggers[idx] = {
      ...draft.triggers[idx]!,
      status: "active",
      updatedAt: now,
    };
  });

  return c.json(serializeTrigger(findTrigger(id)!));
});

studioTriggers.post("/:id/pause", (c) => {
  const id = c.req.param("id")!;
  const existing = findTrigger(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const now = new Date().toISOString();
  studioService.update((draft) => {
    const idx = draft.triggers.findIndex((a) => a.id === id);
    if (idx < 0) return;
    draft.triggers[idx] = {
      ...draft.triggers[idx]!,
      status: "paused",
      updatedAt: now,
    };
  });

  return c.json(serializeTrigger(findTrigger(id)!));
});

studioTriggers.post("/:id/rotate-webhook-secret", (c) => {
  const id = c.req.param("id")!;
  const existing = findTrigger(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const existingSource = triggerSource(existing);
  if (existingSource.type !== "http_webhook") {
    return c.json({ error: "automation is not http_webhook" }, 409);
  }

  const secret = newToken();
  const now = new Date().toISOString();
  studioService.update((draft) => {
    const idx = draft.triggers.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const source = triggerSource(draft.triggers[idx]!);
    if (source.type !== "http_webhook") return;
    draft.triggers[idx] = {
      ...draft.triggers[idx]!,
      source: { ...source, secret },
      updatedAt: now,
    };
  });

  return c.json({
    trigger: serializeTrigger(findTrigger(id)!, { revealTriggerSecret: true }),
    secret,
  });
});

studioTriggers.post("/:id/test-send", async (c) => {
  const id = c.req.param("id")!;
  const existing = findTrigger(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: { email?: string; name?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty */
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return c.json({ error: "valid test email is required" }, 400);
  }

  const payload: Record<string, unknown> = {
    email,
    name: body.name?.trim() || "Test User",
    verifyUrl: "https://example.com/verify?token=test",
    message: "This is a test message from Studio automations.",
    ...(body.payload ?? {}),
  };

  const sendId = newId("autosend");
  const triggerEventId = newId("triggerevent");
  const now = new Date().toISOString();

  studioService.update((draft) => {
    draft.triggerEvents.push({
      id: triggerEventId,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      triggerId: id,
      triggerType: triggerSource(existing).type,
      idempotencyKey: `test_${now}_${email}`,
      recipientEmail: email,
      recipientName: payload.name as string,
      payload,
      status: "queued",
      skipReason: null,
      occurredAt: now,
    });
    draft.triggerSends.push({
      id: sendId,
      triggerId: id,
      triggerEventId,
      subscriberMemberId: null,
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

  const automation = findTrigger(id)!;
  const send = studioService.read().triggerSends.find((s) => s.id === sendId)!;
  const result = await dispatchTriggerSend(automation, send, payload);
  if (!result.ok) {
    return c.json({ error: result.error, triggerSendId: sendId }, 502);
  }

  return c.json({ ok: true, triggerSendId: sendId, triggerEventId });
});

studioTriggers.get("/:id/activity", (c) => {
  const id = c.req.param("id")!;
  if (!findTrigger(id)) return c.json({ error: "not found" }, 404);

  const data = studioService.read();
  const events = data.triggerEvents
    .filter((e) => e.triggerId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map(serializeTriggerEvent);
  const sends = data.triggerSends
    .filter((s) => s.triggerId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(serializeTriggerSend);

  return c.json({ triggerEvents: events, sends });
});

studioTriggers.get("/:id/stats", (c) => {
  const row = findTrigger(c.req.param("id")!);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({
    triggerId: row.id,
    stats: normalizeTriggerStats(row.stats),
    lastTriggeredAt: row.lastTriggeredAt ?? null,
    lastSentAt: row.lastSentAt ?? null,
  });
});
