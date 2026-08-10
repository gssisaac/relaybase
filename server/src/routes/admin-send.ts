import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { createCloudflareClient } from "../lib/cloudflare-config";
import {
  findInvalidRecipients,
  normalizeRecipients,
} from "../lib/recipients";

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
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const from = body.from?.trim();
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const subject = body.subject?.trim();
  const text = body.text?.trim();

  if (!from || !to.length || !subject || !text) {
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
    if (
      result.delivered.length === 0 &&
      result.queued.length === 0 &&
      result.permanentBounces.length > 0
    ) {
      return c.json(
        {
          error: `All recipients permanently bounced: ${result.permanentBounces.join(", ")}`,
          messageId: result.messageId,
        },
        502,
      );
    }
    return c.json({ messageId: result.messageId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    return c.json({ error: message }, 502);
  }
});

export { adminSend };
