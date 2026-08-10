import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { createCloudflareClient } from "../lib/cloudflare-config";
import { recordOpsLog } from "../lib/ops-logs";
import { previewText } from "../lib/inbound-store";
import {
  findInvalidRecipients,
  normalizeRecipients,
} from "../lib/recipients";
import type { SentEmail } from "../../../app/src/email/components/types";

const adminSend = new Hono<{ Bindings: Env }>();

/**
 * Desktop compose send (admin bearer). Same body as /v1/send, without API-key
 * domain scoping — from address must still be a real mailbox address.
 */
adminSend.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: {
    from?: string;
    fromName?: string;
    to?: string | string[];
    cc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    replyTo?: string;
    inReplyTo?: string;
    references?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    await recordOpsLog(c.env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source: "compose",
      error: "Invalid JSON body",
    });
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const from = body.from?.trim();
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const subject = body.subject?.trim();
  const text = body.text?.trim();

  const domain = from ? from.split("@").pop()?.toLowerCase() ?? null : null;
  const toJoined = to.join(", ") || null;
  const ccJoined = cc.length ? cc.join(", ") : undefined;

  if (!from || !to.length || !subject || !text) {
    await recordOpsLog(c.env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source: "compose",
      domain,
      fromAddr: from ?? null,
      toAddr: toJoined,
      subject: subject ?? null,
      error: "from, to, subject, and text are required",
    });
    return c.json(
      { error: "from, to, subject, and text are required" },
      400,
    );
  }

  const invalid = [
    ...findInvalidRecipients(to),
    ...findInvalidRecipients(cc),
  ];
  if (invalid.length) {
    await recordOpsLog(c.env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source: "compose",
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`,
    });
    return c.json(
      { error: `Invalid email address: ${invalid.join(", ")}` },
      400,
    );
  }

  try {
    const cf = await createCloudflareClient(c.env);
    const result = await cf.sendEmail({
      from,
      fromName: body.fromName?.trim() || undefined,
      to: to.length === 1 ? to[0] : to,
      cc: cc.length ? (cc.length === 1 ? cc[0] : cc) : undefined,
      subject,
      text,
      html: body.html,
      replyTo: body.replyTo,
      inReplyTo: body.inReplyTo?.trim() || undefined,
      references: body.references?.trim() || undefined,
    });

    const hadBounces = result.permanentBounces.length > 0;
    const noDisposition =
      result.delivered.length === 0 && result.queued.length === 0;

    const meta: Record<string, unknown> = {
      delivered: result.delivered,
      queued: result.queued,
    };
    if (hadBounces) {
      meta.permanentBounces = result.permanentBounces;
    }

    const sent: SentEmail = {
      id: result.messageId || crypto.randomUUID(),
      from,
      to: toJoined ?? "",
      cc: ccJoined,
      subject,
      bodyPreview: previewText(text),
      sentAt: new Date().toISOString(),
      messageId: result.messageId,
      inReplyTo: body.inReplyTo?.trim(),
      references: body.references?.trim(),
    };

    if (noDisposition) {
      const error = hadBounces
        ? `All recipients permanently bounced: ${result.permanentBounces.join(", ")}`
        : "Cloudflare returned no delivered/queued recipients. The message may bounce asynchronously.";
      await recordOpsLog(c.env.RELAYBASE_LOGS, {
        kind: "send",
        ok: false,
        status: hadBounces ? 502 : 200,
        source: "compose",
        domain,
        fromAddr: from,
        toAddr: toJoined,
        subject,
        messageId: result.messageId,
        error,
        metaJson: JSON.stringify(meta),
      });
      if (hadBounces) {
        return c.json(
          {
            error,
            messageId: result.messageId,
          },
          502,
        );
      }
      return c.json({ messageId: result.messageId, sent });
    }

    // Partial bounce: log as failed so the dashboard catches it, but still
    // return success to the client (CF queued/delivered some recipients).
    const ok = !hadBounces;
    await recordOpsLog(c.env.RELAYBASE_LOGS, {
      kind: "send",
      ok,
      status: 200,
      source: "compose",
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      messageId: result.messageId,
      error: hadBounces
        ? `Some recipients permanently bounced: ${result.permanentBounces.join(", ")}`
        : null,
      metaJson: JSON.stringify(meta),
    });

    return c.json({ messageId: result.messageId, sent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    await recordOpsLog(c.env.RELAYBASE_LOGS, {
      kind: "send",
      ok: false,
      status: 502,
      source: "compose",
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      error: message,
    });
    return c.json({ error: message }, 502);
  }
});

export { adminSend };
