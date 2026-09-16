import type { NewsletterDispatchProgress } from "@/lib/scale/api";

export function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Human-readable countdown until an ISO timestamp (e.g. "in 3 min"). */
export function formatInMinutes(iso: string | null, nowMs = Date.now()): string | null {
  if (!iso) return null;
  const deltaMs = new Date(iso).getTime() - nowMs;
  if (deltaMs <= 0) return "any moment";
  const sec = Math.ceil(deltaMs / 1000);
  if (sec < 60) return "in under 1 min";
  const min = Math.ceil(sec / 60);
  if (min === 1) return "in 1 min";
  return `in ${min} min`;
}

export function dispatchProcessedCount(dispatch: NewsletterDispatchProgress): number {
  return dispatch.queue.processed + dispatch.queue.skipped;
}

export function dispatchRemainingCount(dispatch: NewsletterDispatchProgress): number {
  return dispatch.queue.queued + dispatch.queue.inFlight;
}

export function dispatchProgressPercent(dispatch: NewsletterDispatchProgress): number {
  const total = dispatch.queue.total || dispatch.queue.processed + dispatchRemainingCount(dispatch);
  if (!total) return 0;
  return Math.min(100, Math.round((dispatchProcessedCount(dispatch) / total) * 100));
}
