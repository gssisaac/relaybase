import type { BroadcastStats } from "../db/types";

export function emptyBroadcastStats(): BroadcastStats {
  return {
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    opened: 0,
    totalOpens: 0,
    clicked: 0,
    totalClicks: 0,
    unsubscribed: 0,
  };
}

/** Backfill missing counters when loading legacy JSON. */
export function normalizeBroadcastStats(raw: Partial<BroadcastStats> | undefined): BroadcastStats {
  const base = emptyBroadcastStats();
  if (!raw) return base;
  return {
    sent: raw.sent ?? base.sent,
    delivered: raw.delivered ?? (raw.sent ?? 0) - (raw.bounced ?? 0),
    bounced: raw.bounced ?? 0,
    failed: raw.failed ?? base.failed,
    opened: raw.opened ?? base.opened,
    totalOpens: raw.totalOpens ?? raw.opened ?? base.totalOpens,
    clicked: raw.clicked ?? base.clicked,
    totalClicks: raw.totalClicks ?? raw.clicked ?? base.totalClicks,
    unsubscribed: raw.unsubscribed ?? base.unsubscribed,
  };
}
