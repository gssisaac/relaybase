import { Hono } from "hono";
import type { Env } from "../env";
import { requireApiKey } from "../lib/auth";
import { emailMatchesDomain } from "../lib/crypto";
import { createCloudflareClient } from "../lib/cloudflare-config";

const send = new Hono<{ Bindings: Env }>();

send.post("/", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const { record } = auth;

  let body: {
    from?: string;
    fromName?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    replyTo?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const from = body.from?.trim();
  const to = body.to?.trim();
  const subject = body.subject?.trim();
  const text = body.text?.trim();

  if (!from || !to || !subject || !text) {
    return c.json({ error: "from, to, subject, and text are required" }, 400);
  }

  if (!emailMatchesDomain(from, record.domain)) {
    return c.json(
      { error: `From address must be on ${record.domain}` },
      403,
    );
  }

  try {
    const cf = await createCloudflareClient(c.env);
    const result = await cf.sendEmail({
      from,
      fromName: body.fromName,
      to,
      subject,
      text,
      html: body.html,
      replyTo: body.replyTo,
    });
    return c.json({ messageId: result.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    return c.json({ error: message }, 502);
  }
});

export { send };
