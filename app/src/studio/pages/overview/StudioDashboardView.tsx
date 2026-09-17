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
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { studioApi, type StudioOverview } from "@/studio/api";
import { newsletterDetailHref, useStudioPaths } from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

import { DashboardSendingNewslettersSection } from "./DashboardSendingNewslettersSection";
import { DashboardTemplatesSection } from "./DashboardTemplatesSection";
import { OverviewExpandableBody } from "./OverviewExpandableBody";
import {
  formatOverviewWhen,
  overviewInsetHighlightClassName,
  overviewInsetItemClassName,
} from "./overview-inset-styles";
import { StudioInsightSectionNav } from "./StudioInsightSectionNav";

export function StudioDashboardView() {
  const { schedule, newsletters, subscribers } = useStudioPaths();
  const [data, setData] = useState<StudioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await studioApi.getOverview());
    } catch {
      toast.error("Could not load Studio dashboard — is hq/studio running on port 32832?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scheduledUpcoming =
    data?.schedule.upcomingList.filter((row) => row.status === "scheduled") ?? [];
  const nextScheduled =
    data?.schedule.nextUpcoming?.status === "scheduled" ? data.schedule.nextUpcoming : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="shrink-0 px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <Link href={`${newsletters}?new=1`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              New newsletter
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
        <div className="min-w-0 space-y-2">
          <StudioInsightSectionNav active="dashboard" />
          <div className="space-y-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Create campaigns from templates, track scheduled sends, and manage your subscribers.
            </p>
          </div>
        </div>
      </DesktopTitleBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex flex-col gap-4")}>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading dashboard…</p>
          ) : null}

          {data ? (
            <>
              <DashboardSendingNewslettersSection />

              <DashboardTemplatesSection refreshKey={data.generatedAt} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base">Scheduled campaigns</CardTitle>
                      <CardDescription>
                        {scheduledUpcoming.length > 0
                          ? `${scheduledUpcoming.length} queued in the next 7 days`
                          : "No campaigns queued in the next 7 days"}
                      </CardDescription>
                    </div>
                    <Link href={schedule} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Open schedule
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody className="space-y-3">
                      {nextScheduled ? (
                        <div className={overviewInsetHighlightClassName}>
                          <p className="text-xs font-medium text-muted-foreground">Next scheduled broadcast</p>
                          <p className="font-medium">{nextScheduled.subject || "(No subject)"}</p>
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            {formatOverviewWhen(nextScheduled.scheduledAt)} ·{" "}
                            {nextScheduled.subscriberGroupName ?? "Subscriber group"} ·{" "}
                            {nextScheduled.recipientCount.toLocaleString()} subscribers
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No upcoming email campaigns scheduled yet.</p>
                      )}
                      <ul className="space-y-2">
                        {scheduledUpcoming.map((row) => (
                          <li key={row.id}>
                            <Link
                              href={newsletterDetailHref(row.id, "publish", row.status)}
                              className={cn(
                                overviewInsetItemClassName,
                                "flex items-center justify-between gap-2 text-sm",
                              )}
                            >
                              <span className="min-w-0 truncate font-medium">
                                {row.subject || "(No subject)"}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                <NewsletterStatusBadge status={row.status} />
                                <span className="text-xs text-muted-foreground">
                                  {formatOverviewWhen(row.scheduledAt)}
                                </span>
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
                      <CardTitle className="text-base">Subscriber groups</CardTitle>
                      <CardDescription>
                        {data.subscribers.groupCount} {data.subscribers.groupCount === 1 ? "subscriber group" : "subscriber groups"} ready
                        {data.subscribers.recentSyncStatus.failedGroupsCount > 0
                          ? ` · ${data.subscribers.recentSyncStatus.failedGroupsCount} sync errors`
                          : ""}
                      </CardDescription>
                    </div>
                    <Link href={subscribers} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Manage subscribers
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody>
                      {data.subscribers.groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Create a subscriber group to start organizing and syncing your contacts.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {data.subscribers.groups.map((group) => (
                            <li key={group.id}>
                              <Link
                                href={`${subscribers}?id=${encodeURIComponent(group.id)}`}
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
                Dashboard unavailable. Start hq/studio and refresh.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
