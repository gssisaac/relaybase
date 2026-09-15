import { DEV_ACCOUNT_LINK_ID, store } from "./db/store";
import { syncAudienceGroupAsync } from "./lib/audience-groups/sync";
import { resolveActiveAudienceContacts } from "./lib/audience-groups/resolver";
import { dispatchCampaignToAudience, processCampaignDispatchBatch } from "./lib/campaigns/dispatch";
import { DISPATCH_BATCH_SIZE, DISPATCH_QUEUE_POLL_MS } from "./lib/campaigns/dispatch-progress";
import { rollupCampaignStatsFromRecipients } from "./lib/campaigns/stats";

/**
 * Stand-ins for Cloudflare Cron Trigger + Queue — in-process intervals for
 * local dev (crm-campaign-broadcast-subscriber-model.md §5.1, §5.4).
 */

const SCHEDULE_POLL_MS = 10_000;
const STATS_ROLLUP_MS = DISPATCH_QUEUE_POLL_MS;
const AUDIENCE_CRON_MS = 60_000;

/** §5.1 — synchronous atomic claim on the document store guards against duplicate sends. */
async function claimDueCampaigns(): Promise<void> {
  const now = new Date().toISOString();
  const due = store
    .read()
    .scheduledJobs.filter(
      (j) => (j.kind === "campaign" || j.kind === "broadcast") && j.status === "pending" && j.runAt <= now,
    );

  for (const job of due) {
    let claimedBroadcastId: string | null = null;
    store.update((draft) => {
      const jobIdx = draft.scheduledJobs.findIndex((j) => j.id === job.id && j.status === "pending");
      if (jobIdx < 0) return;
      const bIdx = draft.campaigns.findIndex(
        (b) => b.id === job.refId && b.status === "scheduled",
      );
      if (bIdx < 0) {
        draft.scheduledJobs[jobIdx] = { ...draft.scheduledJobs[jobIdx]!, status: "failed" };
        return;
      }
      draft.scheduledJobs[jobIdx] = { ...draft.scheduledJobs[jobIdx]!, status: "done" };
      const claimedAt = new Date().toISOString();
      draft.campaigns[bIdx] = {
        ...draft.campaigns[bIdx]!,
        status: "sending",
        sentAt: claimedAt,
        startedAt: claimedAt,
        finishedAt: null,
        updatedAt: claimedAt,
      };
      claimedBroadcastId = draft.campaigns[bIdx]!.id;
    });
    if (!claimedBroadcastId) continue;

    try {
      // Late-binding resolution (§1.3): subscribers are resolved *now*, at
      // the exact dispatch moment — not frozen when the broadcast was scheduled.
      const broadcast = store.read().campaigns.find((b) => b.id === claimedBroadcastId)!;
      const members = resolveActiveAudienceContacts(broadcast);
      await dispatchCampaignToAudience(broadcast, members);
    } catch (err) {
      console.error(`[crm-scheduler] broadcast ${claimedBroadcastId} send failed`, err);
      store.update((draft) => {
        const idx = draft.campaigns.findIndex((b) => b.id === claimedBroadcastId);
        if (idx >= 0) {
          const failedAt = new Date().toISOString();
          draft.campaigns[idx] = {
            ...draft.campaigns[idx]!,
            status: "failed",
            finishedAt: failedAt,
            updatedAt: failedAt,
          };
        }
      });
    }
  }
}

/** Drain queued recipients for broadcasts still in `sending` (large scheduled sends). */
async function processSendingBroadcastQueues(): Promise<void> {
  const sending = store
    .read()
    .campaigns.filter(
      (b) => b.accountLinkId === DEV_ACCOUNT_LINK_ID && b.status === "sending",
    );

  for (const broadcast of sending) {
    const pending = store
      .read()
      .recipients.filter(
        (r) =>
          r.campaignId === broadcast.id &&
          (r.status === "queued" || r.status === "sending"),
      );
    if (pending.length === 0) continue;

    try {
      await processCampaignDispatchBatch(broadcast.id, DISPATCH_BATCH_SIZE);
    } catch (err) {
      console.error(`[crm-scheduler] batch send failed for ${broadcast.id}`, err);
    }
  }
}

/** Reconciles stored `stats` from the recipient ledger for in-flight/recently sent broadcasts. */
async function rollupStats(): Promise<void> {
  const data = store.read();
  const active = data.campaigns.filter((b) => b.status === "sent" || b.status === "sending");

  for (const broadcast of active) {
    const recipients = data.recipients.filter((r) => r.campaignId === broadcast.id);
    const events = data.trackingEvents.filter((e) => e.campaignId === broadcast.id);
    const next = rollupCampaignStatsFromRecipients(recipients, events);
    const prev = broadcast.stats;
    if (
      next.sent === prev.sent &&
      next.delivered === prev.delivered &&
      next.bounced === prev.bounced &&
      next.failed === prev.failed &&
      next.skipped === prev.skipped &&
      next.complained === prev.complained &&
      next.opened === prev.opened &&
      next.totalOpens === prev.totalOpens &&
      next.clicked === prev.clicked &&
      next.totalClicks === prev.totalClicks &&
      next.unsubscribed === prev.unsubscribed
    ) {
      continue;
    }

    store.update((draft) => {
      const idx = draft.campaigns.findIndex((b) => b.id === broadcast.id);
      if (idx < 0) return;
      draft.campaigns[idx] = { ...draft.campaigns[idx]!, stats: next };
    });
  }
}

async function pollAudienceCron(): Promise<void> {
  const now = Date.now();
  const groups = store
    .read()
    .audienceGroups.filter(
      (g) =>
        g.accountLinkId === DEV_ACCOUNT_LINK_ID &&
        g.cronEnabled &&
        g.dataSource?.endpointUrl,
    );

  for (const group of groups) {
    const intervalMs = Math.max(15, group.cronIntervalMinutes) * 60_000;
    const last = group.lastSyncAt ? new Date(group.lastSyncAt).getTime() : 0;
    if (last && now - last < intervalMs) continue;
    await syncAudienceGroupAsync(group.id, "cron");
  }
}

export function startScheduler(): void {
  setInterval(() => {
    void claimDueCampaigns().catch((err) => console.error("[crm-scheduler] poll failed", err));
  }, SCHEDULE_POLL_MS);

  setInterval(() => {
    void processSendingBroadcastQueues().catch((err) =>
      console.error("[crm-scheduler] sending queue failed", err),
    );
    void rollupStats().catch((err) => console.error("[crm-scheduler] stats rollup failed", err));
  }, STATS_ROLLUP_MS);

  setInterval(() => {
    void pollAudienceCron().catch((err) => console.error("[crm-scheduler] audience cron failed", err));
  }, AUDIENCE_CRON_MS);

  console.log(
    `[crm-scheduler] polling scheduled sends every ${SCHEDULE_POLL_MS / 1000}s, stats every ${STATS_ROLLUP_MS / 1000}s, audience cron every ${AUDIENCE_CRON_MS / 1000}s`,
  );
}
