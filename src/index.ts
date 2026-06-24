import type { Env } from "./env";
import app from "./app";
import { handleInboundEmail } from "./inbound";
import { enqueueInboundEvent } from "./lib/inbound-events";
import { deliverWebhooks } from "./lib/webhooks";

async function dispatchInboundEvent(
  kv: KVNamespace,
  record: Awaited<ReturnType<typeof handleInboundEmail>>,
): Promise<void> {
  const event = await enqueueInboundEvent(kv, record);
  await deliverWebhooks(kv, record.domain, event);
}

export default {
  fetch: app.fetch,
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    try {
      const record = await handleInboundEmail(message, env);
      ctx.waitUntil(dispatchInboundEvent(env.KEYS, record));
    } catch (error) {
      console.error("Failed to store inbound email", error);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
