import type {
  TriggerSend,
  TriggerStats,
  TriggerTrackingEvent,
} from "../../db/types";

export function emptyTriggerStats(): TriggerStats {
  return {
    triggered: 0,
    matched: 0,
    deduped: 0,
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    skipped: 0,
    complained: 0,
    opened: 0,
    totalOpens: 0,
    clicked: 0,
    totalClicks: 0,
    unsubscribed: 0,
  };
}

export function normalizeTriggerStats(raw: Partial<TriggerStats> | undefined): TriggerStats {
  const base = emptyTriggerStats();
  if (!raw) return base;
  return {
    triggered: raw.triggered ?? base.triggered,
    matched: raw.matched ?? base.matched,
    deduped: raw.deduped ?? base.deduped,
    sent: raw.sent ?? base.sent,
    delivered: raw.delivered ?? base.delivered,
    bounced: raw.bounced ?? base.bounced,
    failed: raw.failed ?? base.failed,
    skipped: raw.skipped ?? base.skipped,
    complained: raw.complained ?? base.complained,
    opened: raw.opened ?? base.opened,
    totalOpens: raw.totalOpens ?? raw.opened ?? base.totalOpens,
    clicked: raw.clicked ?? base.clicked,
    totalClicks: raw.totalClicks ?? raw.clicked ?? base.totalClicks,
    unsubscribed: raw.unsubscribed ?? base.unsubscribed,
  };
}

export function rollupTriggerStatsFromSends(
  sends: TriggerSend[],
  trackingEvents: TriggerTrackingEvent[] = [],
): Omit<TriggerStats, "triggered" | "matched" | "deduped"> {
  const sent = sends.filter((r) => r.status === "delivered" || r.status === "bounced").length;
  const delivered = sends.filter((r) => r.status === "delivered").length;
  const bounced = sends.filter((r) => r.status === "bounced").length;
  const failed = sends.filter((r) => r.status === "failed").length;
  const skipped = sends.filter((r) => r.status === "skipped").length;
  const opened = sends.filter((r) => r.openedAt).length;
  const clicked = sends.filter((r) => r.clickedAt).length;
  const totalOpens = sends.reduce((n, r) => n + r.openCount, 0);
  const totalClicks = sends.reduce((n, r) => n + r.clickCount, 0);
  const unsubscribed = sends.filter((r) => r.unsubscribedAt).length;
  const complained = new Set(
    trackingEvents.filter((e) => e.type === "complaint").map((e) => e.triggerSendId),
  ).size;
  return {
    sent,
    delivered,
    bounced,
    failed,
    skipped,
    complained,
    opened,
    totalOpens,
    clicked,
    totalClicks,
    unsubscribed,
  };
}
