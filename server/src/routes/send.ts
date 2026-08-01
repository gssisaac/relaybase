import { Hono } from "hono";
import type { Env } from "../env";
import { requireApiKey } from "../lib/auth";
import { emailMatchesDomain } from "../lib/crypto";
import { createCloudflareClient } from "../lib/cloudflare-config";
import { recordSendLog } from "../lib/send-logs";
import {
  findInvalidRecipients,
  normalizeRecipients,
} from "../lib/recipients";
import type { KeyRecord } from "../lib/keys";

const send = new Hono<{ Bindings: Env }>();

type SendBody = {
  from?: string;
  fromName?: string;
  to?: string | string[];
  cc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

function keyFields(record: KeyRecord | null) {
  return {
    domain: record?.domain ?? null,
    keyId: record?.id ?? null,
    keyPrefix: record?.keyPrefix ?? null,
    keyLabel: record?.label ?? null,
  };
}

async function logAndRespond(
  c: { env: Env; json: (body: unknown, status?: number) => Response },
  params: {
    ok: boolean;
    status: number;
    body: unknown;
    record?: KeyRecord | null;
    from?: string | null;
    to?: string | null;
    subject?: string | null;
    messageId?: string;
    error?: string;
  },
): Promise<Response> {
  try {
    await recordSendLog(c.env.KEYS, {
      ok: params.ok,
      status: params.status,
      ...keyFields(params.record ?? null),
      from: params.from ?? null,
      to: params.to ?? null,
      subject: params.subject ?? null,
      messageId: params.messageId,
      error: params.error,
    });
  } catch (error) {
    console.error("Failed to record send log", error);
  }
  return c.json(params.body, params.status);
}

send.post("/", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) {
    try {
      await recordSendLog(c.env.KEYS, {
        ok: false,
        status: 401,
        domain: null,
        keyId: null,
        keyPrefix: null,
        keyLabel: null,
        from: null,
        to: null,
        subject: null,
        error: "Invalid or missing API key",
      });
    } catch (error) {
      console.error("Failed to record send log", error);
    }
    return auth;
  }
  const { record } = auth;

  let body: SendBody;
  try {
    body = await c.req.json();
  } catch {
    return logAndRespond(c, {
      ok: false,
      status: 400,
      body: { error: "Invalid JSON body" },
      record,
      error: "Invalid JSON body",
    });
  }

  const from = body.from?.trim();
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const subject = body.subject?.trim();
  const text = body.text?.trim();

  if (!from || !to.length || !subject || !text) {
    return logAndRespond(c, {
      ok: false,
      status: 400,
      body: { error: "from, to, subject, and text are required" },
      record,
      from: from ?? null,
      to: to.join(", ") || null,
      subject: subject ?? null,
      error: "from, to, subject, and text are required",
    });
  }

  const invalid = [
    ...findInvalidRecipients(to),
    ...findInvalidRecipients(cc),
  ];
  if (invalid.length) {
    return logAndRespond(c, {
      ok: false,
      status: 400,
      body: { error: `Invalid email address: ${invalid.join(", ")}` },
      record,
      from,
      to: to.join(", "),
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`,
    });
  }

  if (!emailMatchesDomain(from, record.domain)) {
    return logAndRespond(c, {
      ok: false,
      status: 403,
      body: { error: `From address must be on ${record.domain}` },
      record,
      from,
      to: to.join(", "),
      subject,
      error: `From address must be on ${record.domain}`,
    });
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
    });
    return logAndRespond(c, {
      ok: true,
      status: 200,
      body: { messageId: result.messageId },
      record,
      from,
      to: to.join(", "),
      subject,
      messageId: result.messageId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    return logAndRespond(c, {
      ok: false,
      status: 502,
      body: { error: message },
      record,
      from,
      to: to.join(", "),
      subject,
      error: message,
    });
  }
});

export { send };
