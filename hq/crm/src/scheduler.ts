import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "./db/client";
import { campaigns, scheduledJobs, trackingEvents } from "./db/schema";
import { dispatchCampaign } from "./routes/campaigns";

/**
 * Stand-ins for Cloudflare Cron Trigger + Queue (docs/features/crm-mode-v0.2.md
 * §1.3/§4 P0-5/P0-2) — hq/crm is a plain Node server, so these are in-process
 * intervals instead. Same "not real-time, atomic claim" semantics as spec'd.
 */

const SCHEDULE_POLL_MS = 10_000;
const STATS_ROLLUP_MS = 5_000;

async function claimDueJobs(): Promise<void> {
  const now = new Date().toISOString();
  const due = await db
    .select()
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.status, "pending"), lte(scheduledJobs.runAt, now)));

  for (const job of due) {
    // Atomic claim: only proceed if this row is still "pending" (P0-5 concurrency note).
    const claimed = await db
      .update(scheduledJobs)
      .set({ status: "done" })
      .where(and(eq(scheduledJobs.id, job.id), eq(scheduledJobs.status, "pending")))
      .run();
    if (claimed.changes === 0) continue;

    if (job.kind === "campaign") {
      try {
        await dispatchCampaign(job.refId);
      } catch (err) {
        console.error(`[crm-scheduler] campaign ${job.refId} send failed`, err);
        await db
          .update(scheduledJobs)
          .set({ status: "failed" })
          .where(eq(scheduledJobs.id, job.id));
      }
    }
  }
}

async function rollupStats(): Promise<void> {
  const sending = await db
    .select({ id: campaigns.id, statsJson: campaigns.statsJson })
    .from(campaigns)
    .where(inArray(campaigns.status, ["sent", "sending"]));

  for (const campaign of sending) {
    const opens = await db
      .select({ contactId: trackingEvents.contactId })
      .from(trackingEvents)
      .where(and(eq(trackingEvents.campaignId, campaign.id), eq(trackingEvents.type, "open")));
    const clicks = await db
      .select({ contactId: trackingEvents.contactId })
      .from(trackingEvents)
      .where(and(eq(trackingEvents.campaignId, campaign.id), eq(trackingEvents.type, "click")));

    const opened = new Set(opens.map((r) => r.contactId)).size;
    const clicked = new Set(clicks.map((r) => r.contactId)).size;
    const prev = JSON.parse(campaign.statsJson) as { sent: number };

    await db
      .update(campaigns)
      .set({ statsJson: JSON.stringify({ sent: prev.sent, opened, clicked }) })
      .where(eq(campaigns.id, campaign.id));
  }
}

export function startScheduler(): void {
  setInterval(() => {
    void claimDueJobs().catch((err) => console.error("[crm-scheduler] poll failed", err));
  }, SCHEDULE_POLL_MS);

  setInterval(() => {
    void rollupStats().catch((err) => console.error("[crm-scheduler] stats rollup failed", err));
  }, STATS_ROLLUP_MS);

  console.log(
    `[crm-scheduler] polling scheduled sends every ${SCHEDULE_POLL_MS / 1000}s, stats every ${STATS_ROLLUP_MS / 1000}s`,
  );
}
