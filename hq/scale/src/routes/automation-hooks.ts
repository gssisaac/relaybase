import { Hono } from "hono";

import { verifyCrmWebhookSecret } from "../lib/webhooks/verify-secret";
import { fireAutomation, recordUnmatchedTriggerEvent } from "../lib/automations/fire";
import {
  findAutomationByFormKey,
  findAutomationById,
  findAutomationForInbound,
} from "../lib/automations/matcher";
import { verifyAutomationWebhookSecret } from "../lib/automations/trigger-auth";
export const scaleAutomationHooks = new Hono();

function parseJsonBody<T extends Record<string, unknown>>(c: {
  req: { json: () => Promise<T> };
}): Promise<T | null> {
  return c.req.json().catch(() => null);
}

// POST /scale/hooks/automation/:automationId — http_webhook trigger
scaleAutomationHooks.post("/automation/:automationId", async (c) => {
  const automation = findAutomationById(c.req.param("automationId")!);
  if (!automation) return c.json({ error: "not found" }, 404);
  if (automation.trigger.type !== "http_webhook") {
    return c.json({ error: "automation is not configured for http_webhook" }, 409);
  }
  if (!verifyAutomationWebhookSecret(c, automation.trigger.secret)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const payload = (await parseJsonBody(c)) ?? {};
  const idempotencyKey = c.req.header("Idempotency-Key")?.trim() || null;

  const result = await fireAutomation({
    automation,
    triggerType: "http_webhook",
    payload,
    idempotencyKey,
  });

  return c.json(result, result.skipReason && result.status === "skipped" ? 202 : 200);
});

// POST /scale/hooks/form/:formKey — form_submit trigger
scaleAutomationHooks.post("/form/:formKey", async (c) => {
  if (!verifyCrmWebhookSecret(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const automation = findAutomationByFormKey(c.req.param("formKey")!);
  if (!automation) {
    const payload = (await parseJsonBody(c)) ?? {};
    recordUnmatchedTriggerEvent({
      triggerType: "form_submit",
      payload,
      recipientEmail: typeof payload.email === "string" ? payload.email : undefined,
    });
    return c.json({ error: "no active automation for this form key" }, 404);
  }

  const payload = (await parseJsonBody(c)) ?? {};
  const idempotencyKey = c.req.header("Idempotency-Key")?.trim() || null;

  const result = await fireAutomation({
    automation,
    triggerType: "form_submit",
    payload,
    idempotencyKey,
  });

  return c.json(result, result.skipReason && result.status === "skipped" ? 202 : 200);
});

// POST /scale/hooks/inbound — mailbox_inbound (Worker → CRM)
scaleAutomationHooks.post("/inbound", async (c) => {
  if (!verifyCrmWebhookSecret(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = await parseJsonBody<{
    domain?: string;
    localPart?: string;
    fromEmail?: string;
    fromName?: string;
    subject?: string;
    snippet?: string;
    messageId?: string;
  }>(c);
  if (!body) return c.json({ error: "invalid JSON body" }, 400);

  const domain = body.domain?.trim().toLowerCase();
  const localPart = body.localPart?.trim().toLowerCase();
  if (!domain || !localPart) {
    return c.json({ error: "domain and localPart are required" }, 400);
  }

  const payload: Record<string, unknown> = {
    domain,
    localPart,
    fromEmail: body.fromEmail ?? "",
    fromName: body.fromName ?? null,
    subject: body.subject ?? "",
    snippet: body.snippet ?? "",
    messageId: body.messageId ?? null,
  };

  const automation = findAutomationForInbound({
    domain,
    localPart,
    subject: body.subject,
    fromEmail: body.fromEmail,
  });

  if (!automation) {
    const triggerEventId = recordUnmatchedTriggerEvent({
      triggerType: "mailbox_inbound",
      payload,
      recipientEmail: body.fromEmail,
      idempotencyKey: body.messageId,
    });
    return c.json({ triggerEventId, status: "skipped", skipReason: "no_match" }, 404);
  }

  const idempotencyKey = body.messageId?.trim() || null;
  const result = await fireAutomation({
    automation,
    triggerType: "mailbox_inbound",
    payload,
    idempotencyKey,
    recipientEmail: body.fromEmail,
    recipientName: body.fromName,
  });

  return c.json(result, result.skipReason && result.status === "skipped" ? 202 : 200);
});
