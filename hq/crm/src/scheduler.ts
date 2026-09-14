import { store } from "./db/store";
import { dispatchBroadcastToSubscribers, resolveActiveSubscribers } from "./routes/broadcasts";
import { fetchDataSourceContacts } from "./lib/data-source-sync";
import { newId, newToken } from "./lib/ids";

/**
 * Stand-ins for Cloudflare Cron Trigger + Queue — in-process intervals for
 * local dev (crm-campaign-broadcast-subscriber-model.md §5.1, §5.4).
 */

const SCHEDULE_POLL_MS = 10_000;
const STATS_ROLLUP_MS = 5_000;
const DATA_SOURCE_CRON_MS = 60_000;

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
      const subscribers = resolveActiveSubscribers(broadcast.campaignId);
      await dispatchBroadcastToSubscribers(broadcast, subscribers);
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
    const sent = recipients.filter((r) => r.status === "sent").length;
    const failed = recipients.filter((r) => r.status === "failed").length;
    const opened = recipients.filter((r) => r.openedAt).length;
    const clicked = recipients.filter((r) => r.clickedAt).length;

    if (
      sent === broadcast.stats.sent &&
      failed === broadcast.stats.failed &&
      opened === broadcast.stats.opened &&
      clicked === broadcast.stats.clicked
    ) {
      continue;
    }

    store.update((draft) => {
      const idx = draft.broadcasts.findIndex((b) => b.id === broadcast.id);
      if (idx < 0) return;
      draft.broadcasts[idx] = { ...draft.broadcasts[idx]!, stats: { sent, opened, clicked, failed } };
    });
  }
}

async function pollDataSourceCron(): Promise<void> {
  const now = Date.now();
  const campaigns = store
    .read()
    .campaigns.filter((c) => c.dataSource?.endpointUrl && c.dataSource.cronEnabled);

  for (const campaign of campaigns) {
    const dataSource = campaign.dataSource!;
    const intervalMs = Math.max(15, dataSource.cronIntervalMinutes ?? 60) * 60_000;
    const last = dataSource.lastSyncAt ? new Date(dataSource.lastSyncAt).getTime() : 0;
    if (last && now - last < intervalMs) continue;

    try {
      const { contacts, skipped } = await fetchDataSourceContacts(dataSource);
      const syncedAt = new Date().toISOString();
      let added = 0;
      let updated = 0;
      store.update((draft) => {
        const seen = new Set<string>();
        for (const contact of contacts) {
          const email = contact.email.trim().toLowerCase();
          if (!email.includes("@") || seen.has(email)) continue;
          seen.add(email);
          const idx = draft.subscribers.findIndex(
            (s) => s.campaignId === campaign.id && s.email === email,
          );
          if (idx < 0) {
            draft.subscribers.push({
              id: newId("subscriber"),
              accountLinkId: campaign.accountLinkId,
              campaignId: campaign.id,
              email,
              name: contact.name,
              status: "subscribed",
              source: "sync",
              unsubscribeToken: newToken(),
              unsubscribedAt: null,
              bouncedAt: null,
              bounceReason: null,
              createdAt: syncedAt,
              updatedAt: syncedAt,
            });
            added += 1;
          } else if (
            draft.subscribers[idx]!.status !== "unsubscribed" &&
            draft.subscribers[idx]!.status !== "bounced"
          ) {
            draft.subscribers[idx] = {
              ...draft.subscribers[idx]!,
              name: contact.name ?? draft.subscribers[idx]!.name,
              updatedAt: syncedAt,
            };
            updated += 1;
          }
        }
        const cIdx = draft.campaigns.findIndex((c) => c.id === campaign.id);
        if (cIdx >= 0 && draft.campaigns[cIdx]!.dataSource) {
          draft.campaigns[cIdx] = {
            ...draft.campaigns[cIdx]!,
            dataSource: {
              ...draft.campaigns[cIdx]!.dataSource!,
              lastSyncAt: syncedAt,
              lastSyncStatus: "success",
              lastSyncError: null,
              lastSyncCount: added + updated,
            },
          };
        }
      });
      void skipped;
    } catch (err) {
      const message = err instanceof Error ? err.message : "sync failed";
      const syncedAt = new Date().toISOString();
      store.update((draft) => {
        const cIdx = draft.campaigns.findIndex((c) => c.id === campaign.id);
        if (cIdx >= 0 && draft.campaigns[cIdx]!.dataSource) {
          draft.campaigns[cIdx] = {
            ...draft.campaigns[cIdx]!,
            dataSource: {
              ...draft.campaigns[cIdx]!.dataSource!,
              lastSyncAt: syncedAt,
              lastSyncStatus: "error",
              lastSyncError: message,
            },
          };
        }
      });
    }
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
    void pollDataSourceCron().catch((err) => console.error("[crm-scheduler] data source cron failed", err));
  }, DATA_SOURCE_CRON_MS);

  console.log(
    `[crm-scheduler] polling scheduled sends every ${SCHEDULE_POLL_MS / 1000}s, stats every ${STATS_ROLLUP_MS / 1000}s, data source cron every ${DATA_SOURCE_CRON_MS / 1000}s`,
  );
}
