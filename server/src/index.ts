import type { Env } from "./env";
import app from "./app";
import { handleInboundEmail } from "./inbound";
import { runAudienceCron } from "./lib/catalog-audience";
import { enqueueInboundEvent } from "./lib/inbound-events";
import { deliverWebhooks } from "./lib/webhooks";

async function dispatchInboundEvent(
  kv: KVNamespace,
  record: Awaited<ReturnType<typeof handleInboundEmail>>["record"],
): Promise<void> {
  const event = await enqueueInboundEvent(kv, record);
  await deliverWebhooks(kv, record.domain, event);
}

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runAudienceCron(env.RELAYBASE_APP).catch((error) => {
        console.error("Audience cron failed", error);
      }),
    );
  },
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    try {
      const { record, created } = await handleInboundEmail(message, env);
      if (created) {
        ctx.waitUntil(dispatchInboundEvent(env.RELAYBASE_APP, record));
      }
    } catch (error) {
      console.error("Failed to store inbound email", error);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
