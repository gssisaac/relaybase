import { DEV_ACCOUNT_LINK_ID, store } from "./db/store";
import { resolveActiveAudienceContacts } from "./lib/audience-resolver";
import { dispatchBroadcastToAudience } from "./routes/broadcasts";
import { syncAudienceGroupAsync } from "./routes/audience-groups";

/**
 * Stand-ins for Cloudflare Cron Trigger + Queue — in-process intervals for
 * local dev (crm-campaign-broadcast-subscriber-model.md §5.1, §5.4).
 */

const SCHEDULE_POLL_MS = 10_000;
const STATS_ROLLUP_MS = 5_000;
const AUDIENCE_CRON_MS = 60_000;

/** §5.1 — synchronous atomic claim on the document store guards against duplicate sends. */
async function claimDueBroadcasts(): Promise<void> {
  const now = new Date().toISOString();
  const due = store
    .read()
    .scheduledJobs.filter((j) => j.kind === "broadcast" && j.status === "pending" && j.runAt <= now);

  for (const job of due) {
    let claimedBroadcastId: string | null = null;
    store.update((draft) => {
      const jobIdx = draft.scheduledJobs.findIndex((j) => j.id === job.id && j.status === "pending");
      if (jobIdx < 0) return;
      const bIdx = draft.broadcasts.findIndex(
        (b) => b.id === job.refId && b.status === "scheduled",
      );
      if (bIdx < 0) {
        draft.scheduledJobs[jobIdx] = { ...draft.scheduledJobs[jobIdx]!, status: "failed" };
        return;
      }
      draft.scheduledJobs[jobIdx] = { ...draft.scheduledJobs[jobIdx]!, status: "done" };
      draft.broadcasts[bIdx] = {
        ...draft.broadcasts[bIdx]!,
        status: "sending",
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      claimedBroadcastId = draft.broadcasts[bIdx]!.id;
    });
    if (!claimedBroadcastId) continue;

    try {
      // Late-binding resolution (§1.3): subscribers are resolved *now*, at
      // the exact dispatch moment — not frozen when the broadcast was scheduled.
      const broadcast = store.read().broadcasts.find((b) => b.id === claimedBroadcastId)!;
      const members = resolveActiveAudienceContacts(broadcast);
      await dispatchBroadcastToAudience(broadcast, members);
    } catch (err) {
      console.error(`[crm-scheduler] broadcast ${claimedBroadcastId} send failed`, err);
      store.update((draft) => {
        const idx = draft.broadcasts.findIndex((b) => b.id === claimedBroadcastId);
        if (idx >= 0) draft.broadcasts[idx] = { ...draft.broadcasts[idx]!, status: "failed" };
      });
    }
  }
}

/** Reconciles stored `stats` from the recipient ledger for in-flight/recently sent broadcasts. */
async function rollupStats(): Promise<void> {
  const data = store.read();
  const active = data.broadcasts.filter((b) => b.status === "sent" || b.status === "sending");

  for (const broadcast of active) {
    const recipients = data.recipients.filter((r) => r.broadcastId === broadcast.id);
    const sent = recipients.filter((r) => r.status === "delivered" || r.status === "bounced").length;
    const delivered = recipients.filter((r) => r.status === "delivered").length;
    const bounced = recipients.filter((r) => r.status === "bounced").length;
    const failed = recipients.filter((r) => r.status === "failed").length;
    const opened = recipients.filter((r) => r.openedAt).length;
    const clicked = recipients.filter((r) => r.clickedAt).length;
    const totalOpens = recipients.reduce((n, r) => n + r.openCount, 0);
    const totalClicks = recipients.reduce((n, r) => n + r.clickCount, 0);
    const unsubscribed = recipients.filter((r) => r.unsubscribedAt).length;

    const next = {
      sent,
      delivered,
      bounced,
      failed,
      opened,
      totalOpens,
      clicked,
      totalClicks,
      unsubscribed,
    };
    const prev = broadcast.stats;
    if (
      next.sent === prev.sent &&
      next.delivered === prev.delivered &&
      next.bounced === prev.bounced &&
      next.failed === prev.failed &&
      next.opened === prev.opened &&
      next.totalOpens === prev.totalOpens &&
      next.clicked === prev.clicked &&
      next.totalClicks === prev.totalClicks &&
      next.unsubscribed === prev.unsubscribed
    ) {
      continue;
    }

    store.update((draft) => {
      const idx = draft.broadcasts.findIndex((b) => b.id === broadcast.id);
      if (idx < 0) return;
      draft.broadcasts[idx] = { ...draft.broadcasts[idx]!, stats: next };
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
    void claimDueBroadcasts().catch((err) => console.error("[crm-scheduler] poll failed", err));
  }, SCHEDULE_POLL_MS);

  setInterval(() => {
    void rollupStats().catch((err) => console.error("[crm-scheduler] stats rollup failed", err));
  }, STATS_ROLLUP_MS);

  setInterval(() => {
    void pollAudienceCron().catch((err) => console.error("[crm-scheduler] audience cron failed", err));
  }, AUDIENCE_CRON_MS);

  console.log(
    `[crm-scheduler] polling scheduled sends every ${SCHEDULE_POLL_MS / 1000}s, stats every ${STATS_ROLLUP_MS / 1000}s, audience cron every ${AUDIENCE_CRON_MS / 1000}s`,
  );
}
