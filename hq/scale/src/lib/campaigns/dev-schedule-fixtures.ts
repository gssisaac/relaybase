import type { Campaign, ScaleDataStore } from "../../db/types";

const DEV_ACCOUNT_LINK_ID = "dev";
import { newId } from "../shared/ids";

/** Demo campaigns kept in `data/store.json` — runAt is refreshed on each hq/scale load in dev. */
const DEMO_SCHEDULE_SPECS = [
  { campaignId: "broadcast_scheduled_ama", offsetDays: 1, hourUtc: 3, minuteUtc: 0 },
  { campaignId: "broadcast_sent_sep_digest", offsetDays: 7, hourUtc: 3, minuteUtc: 0 },
  { campaignId: "broadcast_6335f85b-01f5-4ccb-a2c7-37980c32f53c", offsetDays: 14, hourUtc: 3, minuteUtc: 0 },
] as const;

function runAtFromOffset(now: Date, offsetDays: number, hourUtc: number, minuteUtc: number): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString();
}

function syncPendingCampaignJob(
  store: ScaleDataStore,
  campaignId: string,
  runAt: string,
  nowIso: string,
): void {
  if (!store.scheduledJobs) store.scheduledJobs = [];

  store.scheduledJobs = store.scheduledJobs.filter(
    (j) => !(j.kind === "campaign" && j.refId === campaignId && j.status === "pending"),
  );

  store.scheduledJobs.push({
    id: newId("job"),
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    kind: "campaign",
    refId: campaignId,
    runAt,
    status: "pending",
    createdAt: nowIso,
  });
}

function applyScheduleToCampaign(row: Campaign, runAt: string, nowIso: string): boolean {
  const unchanged =
    row.status === "scheduled" &&
    row.scheduledAt === runAt &&
    row.sentAt === null &&
    row.startedAt === null &&
    row.finishedAt === null;
  if (unchanged) return false;

  row.status = "scheduled";
  row.scheduledAt = runAt;
  row.sentAt = null;
  row.startedAt = null;
  row.finishedAt = null;
  row.updatedAt = nowIso;
  return true;
}

/**
 * Dev-only: keep three fixture campaigns scheduled at tomorrow / +7d / +14d and
 * mirror `scheduledJobs` so the in-process scheduler matches hand-edited store.json.
 */
export function ensureDevScheduleFixtures(store: ScaleDataStore, now = new Date()): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.SCALE_DEV_SCHEDULE_FIXTURES === "0") return false;

  const nowIso = now.toISOString();
  let changed = false;

  for (const spec of DEMO_SCHEDULE_SPECS) {
    const row = store.campaigns.find(
      (b) => b.id === spec.campaignId && b.accountLinkId === DEV_ACCOUNT_LINK_ID,
    );
    if (!row || row.listStatus === "archived") continue;
    if (row.status === "sending" || row.status === "sent" || row.status === "failed") continue;

    const runAt = runAtFromOffset(now, spec.offsetDays, spec.hourUtc, spec.minuteUtc);
    if (applyScheduleToCampaign(row, runAt, nowIso)) changed = true;
    syncPendingCampaignJob(store, spec.campaignId, runAt, nowIso);
    changed = true;
  }

  return changed;
}
