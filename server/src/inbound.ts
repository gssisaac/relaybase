import type { Env } from "./env";
import { storeInboundEmail, type InboundEmailMeta } from "./lib/inbound-store";

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<InboundEmailMeta> {
  const raw = await new Response(message.raw).arrayBuffer();
  return storeInboundEmail(env.INBOUND, {
    fromEmail: message.from,
    toEmail: message.to,
    subject: message.headers.get("subject")?.trim() || "(no subject)",
    messageId: message.headers.get("message-id")?.trim() || null,
    size: message.rawSize,
    raw,
  });
}
