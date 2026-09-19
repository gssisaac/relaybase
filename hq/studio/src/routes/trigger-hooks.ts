import { Hono } from "hono";

import { verifyCrmWebhookSecret } from "@lib/webhooks/verify-secret";
import { fireTrigger, recordUnmatchedTriggerEvent } from "@lib/triggers/fire";
import {
  findTriggerById,
  findTriggerForInbound,
} from "@lib/triggers/matcher";
import { verifyTriggerWebhookSecret } from "@lib/triggers/trigger-auth";
import { triggerSource } from "@lib/messages/resolve";
import { parseJsonBody } from "@lib/shared/parse-json-body";

export const studioTriggerHooks = new Hono();

// POST /studio/hooks/trigger/:triggerId — http_webhook
studioTriggerHooks.post("/trigger/:triggerId", async (c) => {
  const automation = findTriggerById(c.req.param("triggerId")!);
  if (!automation) return c.json({ error: "not found" }, 404);
  const source = triggerSource(automation);
  if (source.type !== "http_webhook") {
    return c.json({ error: "automation is not configured for http_webhook" }, 409);
  }
  if (!verifyTriggerWebhookSecret(c, source.secret)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const payload = (await parseJsonBody(c)) ?? {};
  const idempotencyKey = c.req.header("Idempotency-Key")?.trim() || null;

  const result = await fireTrigger({
    automation,
    triggerType: "http_webhook",
    payload,
    idempotencyKey,
  });

  return c.json(result, result.skipReason && result.status === "skipped" ? 202 : 200);
});

// POST /studio/hooks/inbound — mailbox_inbound (Worker → Studio)
studioTriggerHooks.post("/inbound", async (c) => {
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

  const automation = findTriggerForInbound({
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
  const result = await fireTrigger({
    automation,
    triggerType: "mailbox_inbound",
    payload,
    idempotencyKey,
    recipientEmail: body.fromEmail,
    recipientName: body.fromName,
  });

  return c.json(result, result.skipReason && result.status === "skipped" ? 202 : 200);
});
