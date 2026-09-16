"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  dispatchProcessedCount,
  dispatchProgressPercent,
  dispatchRemainingCount,
  formatInMinutes,
  formatWhen,
} from "@/scale/lib/newsletters/newsletter-dispatch-display";
import type { NewsletterDispatchProgress } from "@/lib/scale/api";

type Props = {
  dispatch: NewsletterDispatchProgress;
  /** Optional action (e.g. link to stats) aligned to the right on wide screens. */
  action?: ReactNode;
  compact?: boolean;
};

export function NewsletterSendingProgressPanel({ dispatch, action, compact }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const total = dispatch.queue.total;
  const processed = dispatchProcessedCount(dispatch);
  const remaining = dispatchRemainingCount(dispatch);
  const complete = dispatchProgressPercent(dispatch);
  const etaLabel = formatWhen(dispatch.estimatedCompletionAt);
  const etaIn = formatInMinutes(dispatch.estimatedCompletionAt);
  const nextBatchIn = formatInMinutes(dispatch.nextBatchAt);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
          <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">Sending in progress…</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-sky-900/90 dark:text-sky-200">
            <span className="tabular-nums">
              {processed} of {total || processed + remaining} processed
              {remaining > 0 ? ` · ${remaining} remaining` : ""}
            </span>
            <span className="tabular-nums font-medium">{complete}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sky-200 dark:bg-sky-950">
            <div
              className="h-full bg-sky-600 transition-all duration-300 dark:bg-sky-400"
              style={{ width: `${complete}%` }}
            />
          </div>
        </div>

        {!compact ? (
          <dl className="grid gap-2 text-xs text-sky-900/90 sm:grid-cols-2 dark:text-sky-200">
            <div>
              <dt className="text-sky-800/70 dark:text-sky-400">Estimated completion</dt>
              <dd className="font-medium tabular-nums">
                {remaining > 0 && dispatch.estimatedCompletionAt ? (
                  <>
                    {etaLabel}
                    {etaIn ? <span className="font-normal text-sky-800/80 dark:text-sky-300"> ({etaIn})</span> : null}
                  </>
                ) : (
                  "Finishing up…"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sky-800/70 dark:text-sky-400">Send schedule</dt>
              <dd>
                <span className="font-medium tabular-nums">
                  {dispatch.batchSize} per batch
                </span>
                <span className="text-sky-800/80 dark:text-sky-300">
                  {" "}
                  · every {dispatch.batchIntervalSeconds}s
                </span>
                {remaining > 0 && nextBatchIn ? (
                  <span className="block text-sky-800/80 dark:text-sky-300">
                    Next batch {nextBatchIn}
                    {dispatch.nextBatchAt ? (
                      <span className="tabular-nums"> ({formatWhen(dispatch.nextBatchAt)})</span>
                    ) : null}
                  </span>
                ) : null}
              </dd>
            </div>
            {dispatch.recipientsPerMinute != null && dispatch.recipientsPerMinute > 0 ? (
              <div className="sm:col-span-2">
                <dt className="text-sky-800/70 dark:text-sky-400">Observed throughput</dt>
                <dd className="font-medium tabular-nums">
                  ~{dispatch.recipientsPerMinute.toLocaleString()} recipients/min
                </dd>
              </div>
            ) : null}
            <div className="sm:col-span-2 tabular-nums text-sky-800/80 dark:text-sky-300">
              {dispatch.queue.queued} queued · {dispatch.queue.inFlight} in flight ·{" "}
              {dispatch.queue.processed} delivered/failed · {dispatch.queue.skipped} skipped
              {dispatch.lastBatchAt ? (
                <span className="block">Last batch {formatWhen(dispatch.lastBatchAt)}</span>
              ) : dispatch.startedAt ? (
                <span className="block">Started {formatWhen(dispatch.startedAt)}</span>
              ) : null}
            </div>
          </dl>
        ) : (
          <p className="text-xs text-sky-800/90 dark:text-sky-300">
            {dispatch.batchSize} per batch every {dispatch.batchIntervalSeconds}s
            {remaining > 0 && etaIn ? ` · ETA ${etaIn}` : ""}
          </p>
        )}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
