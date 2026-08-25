import type { Env } from "../../env";
import { cloudflareSendErrorBody } from "../cloudflare-api-hints";
import { sendOutboundEmail } from "../email-send";
import { recordOpsLog } from "../ops-logs";
import { recordSendLog } from "../send-logs";
import { createMailDb } from "../../../db/mail";
import { storeSentMail } from "../mailbox-store";
import {
  findInvalidRecipients,
  normalizeRecipients,
} from "../recipients";

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

async function persistSendLog(
  env: Env,
  entry: Parameters<typeof recordSendLog>[1],
): Promise<void> {
  try {
    await recordSendLog(env.INBOUND, entry);
  } catch (error) {
    console.error("Failed to record send log", error);
  }
}

/**
 * Shared send pipeline used by `/mail/send` (admin token) and `/mobile/send`
 * (mobile password). Validates the body, sends via the EMAIL binding (REST
 * fallback), records an ops log, and returns a Hono-friendly JSON response.
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
    await persistSendLog(env, {
      ok: false,
      status: 400,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from: from ?? null,
      to: toJoined,
      subject: subject ?? null,
      error: "from, to, subject, and text are required",
    });
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
    await persistSendLog(env, {
      ok: false,
      status: 400,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from,
      to: toJoined,
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`,
    });
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
    const result = await sendOutboundEmail(env, {
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
      await persistSendLog(env, {
        ok: false,
        status: 502,
        domain,
        keyId: null,
        keyPrefix: null,
        keyLabel: source,
        from,
        to: toJoined,
        subject,
        messageId: result.messageId,
        error,
      });
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
    await persistSendLog(env, {
      ok,
      status: 200,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from,
      to: toJoined,
      subject,
      messageId: result.messageId,
      error: hadBounces
        ? `Some recipients permanently bounced: ${result.permanentBounces.join(", ")}`
        : undefined,
    });
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

    if (domain) {
      try {
        await storeSentMail(
          env.INBOUND,
          {
            from,
            fromName: body.fromName?.trim() || undefined,
            to,
            cc: cc.length ? cc : undefined,
            subject,
            text,
            html: body.html,
            messageId: result.messageId,
            inReplyTo: body.inReplyTo?.trim() || null,
            references: body.references?.trim() || null,
          },
          createMailDb(env.RELAYBASE_MAIL),
        );
      } catch (error) {
        console.error("Failed to persist sent mail", error);
      }
    }

    return {
      response: new Response(
        JSON.stringify({ messageId: result.messageId }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    await persistSendLog(env, {
      ok: false,
      status: 502,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from,
      to: toJoined,
      subject,
      error: message,
    });
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
      response: new Response(JSON.stringify(cloudflareSendErrorBody(message)), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
}
