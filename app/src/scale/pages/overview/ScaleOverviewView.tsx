"use client";

import Link from "next/link";
import { CalendarClock, Mail, RefreshCw, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { BroadcastStatusBadge } from "@/scale/components/BroadcastStatusBadge";
import { CF_EMAIL_DAILY_SEND_LIMIT } from "@/scale/components/BroadcastCloudflareSendingLimitsCard";
import { scaleApi, type ScaleOverview } from "@/lib/scale/api";
import { broadcastDetailHref, useScalePaths } from "@/scale/lib/paths";
import { cn } from "@/lib/utils";

import {
  ScaleOverviewAudienceChart,
  ScaleOverviewEngagementChart,
  ScaleOverviewSendsChart,
  ScaleOverviewTriggersChart,
} from "./ScaleOverviewCharts";
import { OverviewExpandableBody } from "./OverviewExpandableBody";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

/**
 * Inset rows inside section cards. Dark theme sets --muted == --card, so use --secondary/--accent
 * for a visible lift above the card surface (see globals.css).
 */
const overviewInsetItemClassName =
  "rounded-xl bg-secondary/70 px-3 py-2.5 transition-colors hover:bg-secondary dark:bg-accent/90 dark:hover:bg-accent";

const overviewInsetHighlightClassName = "rounded-xl bg-secondary px-3 py-2.5 dark:bg-accent";

/** Top KPI tiles — lifted from page canvas (#141414) with clear type hierarchy. */
const overviewKpiClassName =
  "block rounded-xl bg-card px-4 py-4 shadow-sm ring-1 ring-border transition-colors hover:bg-secondary/50 dark:hover:bg-accent/55";

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: typeof Mail;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className={overviewKpiClassName}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground">{value}</p>
          <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80 text-muted-foreground dark:bg-accent">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function ScaleOverviewView() {
  const { schedule, automations, broadcasts, audience } = useScalePaths();
  const [data, setData] = useState<ScaleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await scaleApi.getOverview();
      setData(next);
    } catch {
      toast.error("Could not load Scale overview — is hq/scale running on port 32831?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="shrink-0 px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <Link href={broadcasts} className={buttonVariants({ variant: "outline", size: "sm" })}>
              New broadcast
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Schedule, automations, broadcasts, and audience at a glance.
          </p>
        </div>
      </DesktopTitleBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex flex-col gap-4")}>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading overview…</p>
          ) : null}

          {summary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  href={schedule}
                  icon={CalendarClock}
                  label="Schedule"
                  value={String(summary.scheduledSends + summary.sendingNow)}
                  hint={
                    summary.sendingNow > 0
                      ? `${summary.sendingNow} sending now · ${summary.scheduledSends} scheduled`
                      : `${summary.scheduledSends} scheduled sends`
                  }
                />
                <KpiCard
                  href={automations}
                  icon={Zap}
                  label="Automations"
                  value={String(summary.activeAutomations)}
                  hint={`${data?.automations.triggers24h ?? 0} triggers in the last 24h`}
                />
                <KpiCard
                  href={broadcasts}
                  icon={Mail}
                  label="Broadcasts"
                  value={formatCompact(summary.monthlySentVolume)}
                  hint={`${summary.avgOpenRate}% open · ${summary.avgClickRate}% click (all time)`}
                />
                <KpiCard
                  href={audience}
                  icon={Users}
                  label="Audience"
                  value={formatCompact(summary.totalContacts)}
                  hint={`${summary.deliverableRate}% deliverable contacts`}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardTitle className="text-sm">Send volume</CardTitle>
                    <CardDescription className="text-xs">Weekly sent, opens, and clicks</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScaleOverviewSendsChart data={data.charts.sendsByWeek} />
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardTitle className="text-sm">Engagement rates</CardTitle>
                    <CardDescription className="text-xs">All sent broadcasts</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScaleOverviewEngagementChart data={data.charts.engagementRates} />
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardTitle className="text-sm">Automation triggers</CardTitle>
                    <CardDescription className="text-xs">Last 7 days</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScaleOverviewTriggersChart data={data.charts.automationTriggersByDay} />
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader className="gap-0.5 pb-1">
                    <CardTitle className="text-sm">Audience health</CardTitle>
                    <CardDescription className="text-xs">Active, unsubscribed, bounced</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScaleOverviewAudienceChart data={data.charts.audienceHealth} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base">Upcoming schedule</CardTitle>
                      <CardDescription>{data.schedule.upcomingCount} in the next 7 days</CardDescription>
                    </div>
                    <Link href={schedule} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Open schedule
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody className="space-y-3">
                      {data.schedule.nextUpcoming ? (
                        <div className={overviewInsetHighlightClassName}>
                          <p className="text-xs font-medium text-muted-foreground">Next up</p>
                          <p className="font-medium">{data.schedule.nextUpcoming.name}</p>
                          <p className="text-xs text-muted-foreground">{data.schedule.nextUpcoming.subject}</p>
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            {formatWhen(data.schedule.nextUpcoming.scheduledAt)} ·{" "}
                            {data.schedule.nextUpcoming.audienceGroupName ?? "Audience"} ·{" "}
                            {data.schedule.nextUpcoming.recipientCount.toLocaleString()} recipients
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
                      )}
                      <ul className="space-y-2">
                        {data.schedule.upcomingList.map((row) => (
                          <li key={row.id}>
                            <Link
                              href={broadcastDetailHref(row.id, "publish", row.status)}
                              className={cn(
                                overviewInsetItemClassName,
                                "flex items-center justify-between gap-2 text-sm",
                              )}
                            >
                              <span className="min-w-0 truncate font-medium">{row.name}</span>
                              <div className="flex shrink-0 items-center gap-2">
                                <BroadcastStatusBadge status={row.status} />
                                <span className="text-xs text-muted-foreground">{formatWhen(row.scheduledAt)}</span>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </OverviewExpandableBody>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base">Recent broadcasts</CardTitle>
                      <CardDescription>
                        {data.broadcasts.draftCount} drafts · {data.broadcasts.inProgressCount} in progress
                      </CardDescription>
                    </div>
                    <Link href={broadcasts} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      All broadcasts
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Cloudflare daily quota</span>
                          <span className="tabular-nums">
                            {data.broadcasts.cloudflareQuota.usedToday} / {CF_EMAIL_DAILY_SEND_LIMIT}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{
                              width: `${Math.min(100, data.broadcasts.cloudflareQuota.percentUsed)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {data.broadcasts.recentSent.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No completed sends yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {data.broadcasts.recentSent.map((row) => (
                            <li key={row.id}>
                              <Link
                                href={broadcastDetailHref(row.id, "stats", "sent")}
                                className={cn(overviewInsetItemClassName, "block")}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-medium">{row.name}</p>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatWhen(row.sentAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {row.recipientCount.toLocaleString()} sent · {row.openRate}% open · {row.clickRate}%
                                  click
                                </p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </OverviewExpandableBody>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base">Automation activity</CardTitle>
                      <CardDescription>
                        {data.automations.activeCount} active · {data.automations.triggers24h} triggers / 24h
                      </CardDescription>
                    </div>
                    <Link href={automations} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Automations
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody>
                      {data.automations.recentEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No trigger events yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {data.automations.recentEvents.map((row) => (
                            <li
                              key={row.id}
                              className={cn(
                                overviewInsetItemClassName,
                                "flex items-start justify-between gap-2 text-sm",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{row.automationName}</p>
                                <p className="truncate text-xs text-muted-foreground">{row.recipientEmail}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <Badge variant="secondary" className="text-[10px]">
                                  {row.status}
                                </Badge>
                                <p className="mt-1 text-[11px] text-muted-foreground">{formatWhen(row.occurredAt)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </OverviewExpandableBody>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base">Audience groups</CardTitle>
                      <CardDescription>
                        {data.audience.groupCount} groups
                        {data.audience.recentSyncStatus.failedGroupsCount > 0
                          ? ` · ${data.audience.recentSyncStatus.failedGroupsCount} sync errors`
                          : ""}
                      </CardDescription>
                    </div>
                    <Link href={audience} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Audience
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody>
                      {data.audience.groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Create a group to start collecting contacts.</p>
                      ) : (
                        <ul className="space-y-2">
                          {data.audience.groups.map((group) => (
                            <li key={group.id}>
                              <Link
                                href={`${audience}?id=${encodeURIComponent(group.id)}`}
                                className={cn(
                                  overviewInsetItemClassName,
                                  "flex items-center justify-between gap-2",
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{group.name}</p>
                                  <p className="text-xs text-muted-foreground">{group.domain}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm tabular-nums font-medium">
                                    {group.contactCount.toLocaleString()}
                                  </p>
                                  {group.lastSyncStatus === "error" ? (
                                    <Badge variant="destructive" className="mt-0.5 text-[10px]">
                                      Sync error
                                    </Badge>
                                  ) : null}
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </OverviewExpandableBody>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {!loading && !data ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Overview unavailable. Start hq/scale and refresh.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
