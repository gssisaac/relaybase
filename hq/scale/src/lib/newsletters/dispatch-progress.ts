import type { Recipient } from "../../db/types";

/** Recipients processed per scheduler tick (see `DISPATCH_QUEUE_POLL_MS`). */
export const DISPATCH_BATCH_SIZE = 20;

/** How often the dev scheduler drains queued sends (Cloudflare Queue / Cron in prod). */
export const DISPATCH_QUEUE_POLL_MS = 5_000;

export type NewsletterDispatchProgress = {
  batchSize: number;
  batchIntervalSeconds: number;
  queue: {
    total: number;
    queued: number;
    inFlight: number;
    processed: number;
    skipped: number;
  };
  startedAt: string | null;
  lastBatchAt: string | null;
  nextBatchAt: string | null;
  estimatedCompletionAt: string | null;
  /** Observed send throughput from dispatch start; null until enough samples. */
  recipientsPerMinute: number | null;
};

function queueCounts(recipients: Recipient[]) {
  const queued = recipients.filter((r) => r.status === "queued").length;
  const inFlight = recipients.filter((r) => r.status === "sending").length;
  const processed = recipients.filter(
    (r) => r.status === "delivered" || r.status === "bounced" || r.status === "failed",
  ).length;
  const skipped = recipients.filter((r) => r.status === "skipped").length;
  return {
    total: recipients.length,
    queued,
    inFlight,
    processed,
    skipped,
  };
}

function lastBatchAtFromRecipients(recipients: Recipient[]): string | null {
  return (
    recipients
      .map((r) => r.sentAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null
  );
}

export function buildNewsletterDispatchProgress(input: {
  recipients: Recipient[];
  startedAt: string | null;
  now?: Date;
}): NewsletterDispatchProgress | null {
  const queue = queueCounts(input.recipients);
  const remaining = queue.queued + queue.inFlight;
  if (queue.total === 0 && !input.startedAt) return null;

  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const lastBatchAt = lastBatchAtFromRecipients(input.recipients);
  const startedMs = input.startedAt ? new Date(input.startedAt).getTime() : null;

  let nextBatchAt: string | null = null;
  if (remaining > 0) {
    if (lastBatchAt) {
      const nextMs = new Date(lastBatchAt).getTime() + DISPATCH_QUEUE_POLL_MS;
      nextBatchAt = new Date(Math.max(nextMs, nowMs)).toISOString();
    } else if (startedMs) {
      nextBatchAt = new Date(startedMs + DISPATCH_QUEUE_POLL_MS).toISOString();
    } else {
      nextBatchAt = new Date(nowMs + DISPATCH_QUEUE_POLL_MS).toISOString();
    }
  }

  const finishedUnits = queue.processed + queue.skipped;
  let recipientsPerMinute: number | null = null;
  let estimatedCompletionAt: string | null = null;

  if (remaining <= 0) {
    estimatedCompletionAt = null;
  } else if (startedMs && finishedUnits >= 5) {
    const elapsedMs = Math.max(1, nowMs - startedMs);
    const msPerUnit = elapsedMs / finishedUnits;
    recipientsPerMinute = Math.round((finishedUnits / elapsedMs) * 60_000);
    estimatedCompletionAt = new Date(nowMs + remaining * msPerUnit).toISOString();
  } else {
    const batches = Math.ceil(remaining / DISPATCH_BATCH_SIZE);
    estimatedCompletionAt = new Date(nowMs + batches * DISPATCH_QUEUE_POLL_MS).toISOString();
  }

  return {
    batchSize: DISPATCH_BATCH_SIZE,
    batchIntervalSeconds: DISPATCH_QUEUE_POLL_MS / 1000,
    queue,
    startedAt: input.startedAt,
    lastBatchAt,
    nextBatchAt,
    estimatedCompletionAt,
    recipientsPerMinute,
  };
}
