import type { Env } from "./env";
import app from "./app";
import { handleInboundEmail } from "./inbound";
import { runAudienceCron } from "./lib/catalog-audience";
import { enqueueInboundEvent } from "./lib/inbound-events";
import { deliverWebhooks } from "./lib/webhooks";
import { createAppDb, type AppDb } from "../db/app";

async function dispatchInboundEvent(
  db: AppDb,
  record: Awaited<ReturnType<typeof handleInboundEmail>>["record"],
): Promise<void> {
  const event = await enqueueInboundEvent(db, record);
  await deliverWebhooks(db, record.domain, event);
}

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runAudienceCron(createAppDb(env.RELAYBASE_DB)).catch((error) => {
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
        ctx.waitUntil(dispatchInboundEvent(createAppDb(env.RELAYBASE_DB), record));
      }
    } catch (error) {
      console.error("Failed to store inbound email", error);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
