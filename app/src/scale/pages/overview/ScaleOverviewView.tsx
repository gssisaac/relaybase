"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { BroadcastStatusBadge } from "@/scale/components/BroadcastStatusBadge";
import { CF_EMAIL_SENDING_LIMITS_URL } from "@/scale/components/BroadcastCloudflareSendingLimitsCard";
import { scaleApi, type ScaleOverview } from "@/lib/scale/api";
import { broadcastDetailHref, useScalePaths } from "@/scale/lib/paths";
import { cn } from "@/lib/utils";

import { OverviewExpandableBody } from "./OverviewExpandableBody";
import { ScaleOverviewTopSection } from "./ScaleOverviewTopSection";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Inset rows inside section cards. Dark theme sets --muted == --card, so use --secondary/--accent
 * for a visible lift above the card surface (see globals.css).
 */
const overviewInsetItemClassName =
  "rounded-xl bg-secondary/70 px-3 py-2.5 transition-colors hover:bg-secondary dark:bg-accent/90 dark:hover:bg-accent";

const overviewInsetHighlightClassName = "rounded-xl bg-secondary px-3 py-2.5 dark:bg-accent";

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
              <ScaleOverviewTopSection
                data={data}
                paths={{ schedule, automations, broadcasts, audience }}
              />

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
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sent today (Scale)</span>
                          <span className="tabular-nums font-medium">
                            {data.broadcasts.cloudflareQuota.usedToday}
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Cloudflare&apos;s daily cap is account-specific and not shown here.{" "}
                          <a
                            href={CF_EMAIL_SENDING_LIMITS_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            Limits docs
                          </a>
                        </p>
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
