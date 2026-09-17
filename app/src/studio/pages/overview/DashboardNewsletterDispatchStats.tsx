"use client";

import type { NewsletterDispatchProgress } from "@/studio/api";
import {
  dispatchProcessedCount,
  dispatchProgressPercent,
  dispatchRemainingCount,
  formatInMinutes,
} from "@/studio/lib/newsletters/newsletter-dispatch-display";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}

/** Dashboard-only dispatch readout — stats and progress bar, no in-flight chrome. */
export function DashboardNewsletterDispatchStats({
  dispatch,
}: {
  dispatch: NewsletterDispatchProgress;
}) {
  const processed = dispatchProcessedCount(dispatch);
  const remaining = dispatchRemainingCount(dispatch);
  const total = dispatch.queue.total || processed + remaining;
  const percent = dispatchProgressPercent(dispatch);
  const etaIn = formatInMinutes(dispatch.estimatedCompletionAt);
  const throughput =
    dispatch.recipientsPerMinute != null && dispatch.recipientsPerMinute > 0
      ? dispatch.recipientsPerMinute
      : null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Send progress
          </p>
          <p className="text-xl font-semibold tabular-nums leading-none">{percent}%</p>
        </div>
        <p className="text-right text-xs tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{processed.toLocaleString()}</span>
          {" / "}
          {total.toLocaleString()} processed
          {remaining > 0 ? (
            <>
              <br />
              {remaining.toLocaleString()} remaining
            </>
          ) : null}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-xs">
        <Stat label="Queued" value={dispatch.queue.queued} />
        <Stat label="In flight" value={dispatch.queue.inFlight} />
        <Stat label="Delivered" value={dispatch.queue.processed} />
        <Stat label="Skipped" value={dispatch.queue.skipped} />
      </dl>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
        {remaining > 0 && etaIn ? <span>ETA {etaIn}</span> : null}
        {throughput != null ? (
          <span className="tabular-nums">~{throughput.toLocaleString()}/min</span>
        ) : null}
        <span className="tabular-nums">
          {dispatch.batchSize} per batch · every {dispatch.batchIntervalSeconds}s
        </span>
      </div>
    </div>
  );
}
