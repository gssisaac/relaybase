import { DEV_ACCOUNT_LINK_ID, store } from "./db/store";
import { syncAudienceGroupAsync } from "./routes/audience";
import { dispatchCampaign, type CampaignRecipient } from "./routes/campaigns";

/**
 * Stand-ins for Cloudflare Cron Trigger + Queue — in-process intervals for local dev.
 */

const SCHEDULE_POLL_MS = 10_000;
const STATS_ROLLUP_MS = 5_000;
const AUDIENCE_CRON_MS = 60_000;

function recipientsFromCampaignSegment(segmentJson: string): CampaignRecipient[] {
  try {
    const parsed = JSON.parse(segmentJson) as { recipients?: CampaignRecipient[] };
    if (!Array.isArray(parsed.recipients)) return [];
    return parsed.recipients
      .map((r) => ({
        email: String(r.email ?? "")
          .trim()
          .toLowerCase(),
        name: r.name?.trim() || null,
      }))
      .filter((r) => r.email.includes("@"));
  } catch {
    return [];
  }
}

async function claimDueJobs(): Promise<void> {
  const now = new Date().toISOString();
  const data = store.read();
  const due = data.scheduledJobs.filter((j) => j.status === "pending" && j.runAt <= now);

  for (const job of due) {
    let claimed = false;
    store.update((draft) => {
      const idx = draft.scheduledJobs.findIndex((j) => j.id === job.id && j.status === "pending");
      if (idx < 0) return;
      draft.scheduledJobs[idx] = { ...draft.scheduledJobs[idx]!, status: "done" };
      claimed = true;
    });
    if (!claimed) continue;

    if (job.kind === "campaign") {
      try {
        const campaign = store.read().campaigns.find((c) => c.id === job.refId);
        const recipients = campaign ? recipientsFromCampaignSegment(campaign.segmentJson) : [];
        await dispatchCampaign(job.refId, recipients);
      } catch (err) {
        console.error(`[crm-scheduler] campaign ${job.refId} send failed`, err);
        store.update((draft) => {
          const idx = draft.scheduledJobs.findIndex((j) => j.id === job.id);
          if (idx >= 0) draft.scheduledJobs[idx] = { ...draft.scheduledJobs[idx]!, status: "failed" };
        });
      }
    }
  }
}

async function rollupStats(): Promise<void> {
  const data = store.read();
  const sending = data.campaigns.filter((c) => c.status === "sent" || c.status === "sending");

  for (const campaign of sending) {
    const events = data.trackingEvents.filter((e) => e.campaignId === campaign.id);
    const opened = new Set(events.filter((e) => e.type === "open").map((e) => e.memberEmail)).size;
    const clicked = new Set(events.filter((e) => e.type === "click").map((e) => e.memberEmail)).size;
    const prev = JSON.parse(campaign.statsJson) as { sent: number };

    store.update((draft) => {
      const idx = draft.campaigns.findIndex((c) => c.id === campaign.id);
      if (idx < 0) return;
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        statsJson: JSON.stringify({ sent: prev.sent, opened, clicked }),
      };
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
    void claimDueJobs().catch((err) => console.error("[crm-scheduler] poll failed", err));
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
