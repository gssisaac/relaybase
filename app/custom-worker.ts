// @ts-expect-error `.open-next/worker.js` is generated at build time by `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";

import { runAudienceGroupCron } from "@/lib/audience-cron";

type MinimalScheduledEvent = { cron: string; scheduledTime: number };
type MinimalExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const worker = {
  fetch: handler.fetch,

  async scheduled(
    _event: MinimalScheduledEvent,
    env: CloudflareEnv,
    ctx: MinimalExecutionContext,
  ) {
    ctx.waitUntil(runAudienceGroupCron(env));
  },
};

export default worker;
