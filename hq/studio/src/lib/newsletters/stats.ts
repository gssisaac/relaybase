import type { NewsletterStats, Recipient, TrackingEvent } from "@db/types";

export function emptyNewsletterStats(): NewsletterStats {
  return {
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

/** Backfill missing counters when loading legacy JSON. */
export function normalizeNewsletterStats(raw: Partial<NewsletterStats> | undefined): NewsletterStats {
  const base = emptyNewsletterStats();
  if (!raw) return base;
  return {
    sent: raw.sent ?? base.sent,
    delivered: raw.delivered ?? (raw.sent ?? 0) - (raw.bounced ?? 0),
    bounced: raw.bounced ?? 0,
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

/** Roll up engagement from the recipient ledger + tracking events. */
export function rollupNewsletterStatsFromRecipients(
  recipients: Recipient[],
  trackingEvents: TrackingEvent[] = [],
): NewsletterStats {
  const sent = recipients.filter((r) => r.status === "delivered" || r.status === "bounced").length;
  const delivered = recipients.filter((r) => r.status === "delivered").length;
  const bounced = recipients.filter((r) => r.status === "bounced").length;
  const failed = recipients.filter((r) => r.status === "failed").length;
  const skipped = recipients.filter((r) => r.status === "skipped").length;
  const opened = recipients.filter((r) => r.openedAt).length;
  const clicked = recipients.filter((r) => r.clickedAt).length;
  const totalOpens = recipients.reduce((n, r) => n + r.openCount, 0);
  const totalClicks = recipients.reduce((n, r) => n + r.clickCount, 0);
  const unsubscribed = recipients.filter((r) => r.unsubscribedAt).length;
  const complained = new Set(
    trackingEvents.filter((e) => e.type === "complaint").map((e) => e.recipientId),
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
