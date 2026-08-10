import type { Env } from "../../env";
import { createCloudflareClient } from "../cloudflare-config";
import { recordOpsLog } from "../ops-logs";
import { previewText } from "../inbound-store";
import {
  findInvalidRecipients,
  normalizeRecipients,
} from "../recipients";
import type { SentEmail } from "../../../../app/src/email/components/types";

export type SendMailBody = {
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

export type SendMailResult = {
  response: Response;
};

export type SendMailSource = "compose" | "api" | "mobile";

/**
 * Shared send pipeline used by `/mail/send` (admin token) and `/mobile/send`
 * (mobile password). Validates the body, calls the Cloudflare Email Routing
 * send API, records an ops log, and returns a Hono-friendly JSON response.
 *
 * `source` controls the ops-log `source` field so the Dashboard Log page can
 * distinguish desktop compose, API-key sends, and mobile sends.
 */
export async function sendMailMessage(
  env: Env,
  body: SendMailBody,
  source: SendMailSource,
): Promise<SendMailResult> {
  const from = body.from?.trim();
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const subject = body.subject?.trim();
  const text = body.text?.trim();

  const domain = from ? from.split("@").pop()?.toLowerCase() ?? null : null;
  const toJoined = to.join(", ") || null;
  const ccJoined = cc.length ? cc.join(", ") : undefined;

  if (!from || !to.length || !subject || !text) {
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source,
      domain,
      fromAddr: from ?? null,
      toAddr: toJoined,
      subject: subject ?? null,
      error: "from, to, subject, and text are required",
    });
    return {
      response: new Response(
        JSON.stringify({ error: "from, to, subject, and text are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const invalid = [...findInvalidRecipients(to), ...findInvalidRecipients(cc)];
  if (invalid.length) {
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source,
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`,
    });
    return {
      response: new Response(
        JSON.stringify({ error: `Invalid email address: ${invalid.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  try {
    const cf = await createCloudflareClient(env);
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
    const allFailed =
      result.delivered.length === 0 &&
      result.queued.length === 0 &&
      hadBounces;

    const meta: Record<string, unknown> = {
      delivered: result.delivered,
      queued: result.queued,
    };
    if (hadBounces) {
      meta.permanentBounces = result.permanentBounces;
    }

    if (allFailed) {
      const error = `All recipients permanently bounced: ${result.permanentBounces.join(", ")}`;
      await recordOpsLog(env.RELAYBASE_LOGS, {
        kind: "send",
        ok: false,
        status: 502,
        source,
        domain,
        fromAddr: from,
        toAddr: toJoined,
        subject,
        messageId: result.messageId,
        error,
        metaJson: JSON.stringify(meta),
      });
      return {
        response: new Response(
          JSON.stringify({ error, messageId: result.messageId }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
      };
    }

    const ok = !hadBounces;
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "send",
      ok,
      status: 200,
      source,
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

    return {
      response: new Response(
        JSON.stringify({ messageId: result.messageId, sent }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "send",
      ok: false,
      status: 502,
      source,
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      error: message,
    });
    return {
      response: new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
}
