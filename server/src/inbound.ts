import type { Env } from "./env";
import {
  storeInboundEmail,
  type StoreInboundEmailResult,
} from "./lib/inbound-store";

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<StoreInboundEmailResult> {
  const raw = await new Response(message.raw).arrayBuffer();
  return storeInboundEmail(env.INBOUND, {
    fromEmail: message.from,
    toEmail: message.to,
    subject: message.headers.get("subject")?.trim() || "(no subject)",
    messageId: message.headers.get("message-id")?.trim() || null,
    inReplyTo: message.headers.get("in-reply-to")?.trim() || null,
    references: message.headers.get("references")?.trim() || null,
    size: message.rawSize,
    raw,
  });
}
