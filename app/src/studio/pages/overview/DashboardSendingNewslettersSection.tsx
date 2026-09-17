"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { studioApi, type InProgressOverview } from "@/studio/api";
import { formatInMinutes } from "@/studio/lib/newsletters/newsletter-dispatch-display";
import { useStudioPaths } from "@/studio/lib/paths";
import { buildDashboardSendingAggregate } from "@/studio/pages/overview/dashboard-sending-aggregate";
import { cn } from "@/lib/utils";

const POLL_MS = 5_000;

function Metric({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums leading-tight">{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DashboardSendingNewslettersSection() {
  const { newslettersInProgress } = useStudioPaths();
  const [data, setData] = useState<InProgressOverview | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await studioApi.getInProgressOverview());
    } catch {
      /* dashboard still usable without this block */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.sending.length) return;
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [data?.sending.length, load]);

  const sending = data?.sending ?? [];
  const aggregate = useMemo(() => buildDashboardSendingAggregate(sending), [sending]);

  if (sending.length === 0) return null;

  const etaLabel = formatInMinutes(aggregate.latestEtaIso);

  return (
    <Card className="w-full shrink-0">
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 pb-2 pt-5">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-base">Sending now</CardTitle>
          <CardDescription>
            {aggregate.newsletterCount === 1
              ? "1 newsletter dispatch in progress"
              : `${aggregate.newsletterCount} newsletter dispatches in progress`}
          </CardDescription>
        </div>
        <Link href={newslettersInProgress} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          View all
        </Link>
      </CardHeader>
      <CardContent className="pb-5 pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            label="Newsletters"
            value={aggregate.newsletterCount.toLocaleString()}
            hint="Currently sending"
          />
          <Metric
            label="Recipients"
            value={`${aggregate.processed.toLocaleString()} / ${aggregate.recipientTotal.toLocaleString()}`}
            hint={
              aggregate.remaining > 0
                ? `${aggregate.remaining.toLocaleString()} remaining`
                : "Queue draining"
            }
          />
          <Metric
            label="Complete"
            value={`${aggregate.overallPercent}%`}
            hint={`${aggregate.delivered.toLocaleString()} delivered`}
          />
          <Metric
            label="Failure rate"
            value={`${aggregate.failureRate}%`}
            hint={`${(aggregate.failed + aggregate.bounced).toLocaleString()} failed · ${aggregate.skipped.toLocaleString()} skipped`}
          />
          <Metric
            label="Est. finish"
            value={aggregate.remaining > 0 && etaLabel ? etaLabel : "—"}
            hint={
              aggregate.remaining > 0
                ? `${aggregate.queued.toLocaleString()} queued · ${aggregate.inFlight.toLocaleString()} in flight`
                : "Finishing batches"
            }
          />
          <Metric
            label="Throughput"
            value={
              aggregate.throughputPerMin != null
                ? `~${aggregate.throughputPerMin.toLocaleString()}/min`
                : "—"
            }
            hint="Observed send rate"
          />
        </div>
      </CardContent>
    </Card>
  );
}
