import type { NewsletterDispatchProgress } from "../newsletters/dispatch-progress";
import type { NewsletterInProgressOverview } from "../newsletters/overview";

export type DashboardSendingAggregate = {
  newsletterCount: number;
  recipientTotal: number;
  processed: number;
  remaining: number;
  queued: number;
  inFlight: number;
  delivered: number;
  failed: number;
  bounced: number;
  skipped: number;
  failureRate: number;
  overallPercent: number;
  latestEtaIso: string | null;
  throughputPerMin: number | null;
};

function dispatchProcessedCount(dispatch: NewsletterDispatchProgress): number {
  return dispatch.queue.processed + dispatch.queue.skipped;
}

function dispatchRemainingCount(dispatch: NewsletterDispatchProgress): number {
  return dispatch.queue.queued + dispatch.queue.inFlight;
}

function failureRate(failed: number, bounced: number, processed: number): number {
  if (processed <= 0) return 0;
  return Number((((failed + bounced) / processed) * 100).toFixed(1));
}

export function buildDashboardSendingAggregate(
  rows: NewsletterInProgressOverview["sending"],
): DashboardSendingAggregate | null {
  if (rows.length === 0) return null;

  let recipientTotal = 0;
  let processed = 0;
  let remaining = 0;
  let queued = 0;
  let inFlight = 0;
  let delivered = 0;
  let failed = 0;
  let bounced = 0;
  let skipped = 0;
  let latestEtaMs = 0;
  let latestEtaIso: string | null = null;
  let throughputSum = 0;
  let throughputSamples = 0;

  for (const row of rows) {
    const stats = row.newsletter.stats;
    delivered += stats.delivered;
    failed += stats.failed;
    bounced += stats.bounced;

    if (row.dispatch) {
      const d = row.dispatch;
      const total = d.queue.total || dispatchProcessedCount(d) + dispatchRemainingCount(d);
      recipientTotal += total;
      processed += dispatchProcessedCount(d);
      remaining += dispatchRemainingCount(d);
      queued += d.queue.queued;
      inFlight += d.queue.inFlight;
      skipped += d.queue.skipped;

      if (d.estimatedCompletionAt && dispatchRemainingCount(d) > 0) {
        const ms = new Date(d.estimatedCompletionAt).getTime();
        if (ms > latestEtaMs) {
          latestEtaMs = ms;
          latestEtaIso = d.estimatedCompletionAt;
        }
      }
      if (d.recipientsPerMinute != null && d.recipientsPerMinute > 0) {
        throughputSum += d.recipientsPerMinute;
        throughputSamples += 1;
      }
    } else {
      recipientTotal += row.queue.total;
      processed += row.queue.processed + row.queue.skipped;
      remaining += row.queue.queued + row.queue.sending;
      queued += row.queue.queued;
      inFlight += row.queue.sending;
      skipped += row.queue.skipped;
    }
  }

  const overallPercent =
    recipientTotal > 0 ? Math.min(100, Math.round((processed / recipientTotal) * 100)) : 0;

  return {
    newsletterCount: rows.length,
    recipientTotal,
    processed,
    remaining,
    queued,
    inFlight,
    delivered,
    failed,
    bounced,
    skipped,
    failureRate: failureRate(failed, bounced, processed),
    overallPercent,
    latestEtaIso,
    throughputPerMin:
      throughputSamples > 0 ? Math.round(throughputSum / throughputSamples) : null,
  };
}
