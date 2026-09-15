"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { scaleApi, type TriggerStatsOverview } from "@/lib/scale/api";
import { cn, formatRelativeDate } from "@/lib/utils";
import { TriggerStatusBadge } from "@/scale/components/triggers/TriggerStatusBadge";
import { triggerDetailHref } from "@/scale/lib/paths";
import { ScaleOverviewTriggersChart } from "@/scale/pages/overview/ScaleOverviewCharts";

function rateLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function TriggerStatsOverviewView() {
  const [data, setData] = useState<TriggerStatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await scaleApi.getTriggerStatsOverview());
    } catch {
      toast.error("Could not load trigger statistics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        }
      >
        <div className="min-w-0 space-y-1">
          <Link
            href="/scale/triggers"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 mb-1 h-7 gap-1 px-2 text-xs text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Automations
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">Trigger statistics</h1>
          <p className="text-sm text-muted-foreground">
            Triggers, delivery, and engagement across all triggers.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex flex-col gap-4")}>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading trigger statistics…</p>
          ) : null}

          {data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardDescription>Triggers (24h)</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{data.triggers24h}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {data.triggers7d} in the last 7 days
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardDescription>Triggered (all time)</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {data.totals.triggered.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {data.totals.matched} matched · {data.totals.deduped} deduped ·{" "}
                    {data.totals.skipped} skipped
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardDescription>Delivered</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {data.totals.delivered.toLocaleString()}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({rateLabel(data.rates.delivery)})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {data.totals.failed} failed · {data.totals.bounced} bounced
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardDescription>Engagement</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {data.totals.opened.toLocaleString()}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        open {rateLabel(data.rates.open)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {data.totals.clicked} clicked ({rateLabel(data.rates.click)})
                  </CardContent>
                </Card>
              </div>

              <Card size="sm">
                <CardHeader className="gap-0.5 pb-1">
                  <CardTitle className="text-sm">Trigger triggers</CardTitle>
                  <CardDescription className="text-xs">Last 7 days</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScaleOverviewTriggersChart data={data.byDay} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By automation</CardTitle>
                  <CardDescription>
                    {data.totals.triggers} automations · sorted by lifetime triggers
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.byTrigger.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">No triggers yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.byTrigger.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={triggerDetailHref(row.id, "stats", row.status)}
                            className="flex flex-wrap items-center gap-2 px-6 py-3 text-sm transition-colors hover:bg-muted/40"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                            <TriggerStatusBadge status={row.status} />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {row.stats.triggered} triggered · {row.triggers24h} / 24h ·{" "}
                              {row.stats.delivered} delivered
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent trigger events</CardTitle>
                  <CardDescription>Latest fires across all triggers</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.recentEvents.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">No trigger events yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.recentEvents.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center gap-2 px-6 py-2.5 text-sm"
                        >
                          <span className="min-w-0 truncate font-medium">
                            {row.triggerName}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {row.recipientEmail || "—"}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {row.status}
                          </Badge>
                          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatRelativeDate(row.occurredAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
