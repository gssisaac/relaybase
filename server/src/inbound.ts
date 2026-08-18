import type { Env } from "./env";
import {
  buildBouncePreview,
  isBounceMessage,
  parseBounceDiagnostic,
} from "./lib/bounce-detect";
import { recordOpsLog } from "./lib/ops-logs";
import {
  storeInboundEmail,
  type StoreInboundEmailResult,
} from "./lib/inbound-store";

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<StoreInboundEmailResult> {
  const raw = await new Response(message.raw).arrayBuffer();
  const result = await storeInboundEmail(
    env.INBOUND,
    {
      envelopeFrom: message.from,
      toEmail: message.to,
      subject: message.headers.get("subject")?.trim() || "(no subject)",
      messageId: message.headers.get("message-id")?.trim() || null,
      inReplyTo: message.headers.get("in-reply-to")?.trim() || null,
      references: message.headers.get("references")?.trim() || null,
      size: message.rawSize,
      raw,
    },
    env.RELAYBASE_INBOX_INDEX,
  );

  if (isBounceMessage(raw, message.from)) {
    const diagnostic = parseBounceDiagnostic(raw);
    const error = buildBouncePreview(diagnostic, "Bounce: delivery failed");
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "bounce",
      ok: false,
      source: "inbound",
      domain: result.record.domain,
      fromAddr: message.from,
      toAddr: diagnostic.finalRecipient ?? message.to,
      subject: result.record.subject,
      messageId: result.record.messageId,
      error,
      metaJson: JSON.stringify({
        inboundId: result.record.id,
        dsnStatus: diagnostic.status,
        diagnosticCode: diagnostic.diagnosticCode,
      }),
    });
  }

  return result;
}
