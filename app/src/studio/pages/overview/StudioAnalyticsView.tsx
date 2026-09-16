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
import { CF_EMAIL_SENDING_LIMITS_URL } from "@/studio/components/newsletters/NewsletterCloudflareSendingLimitsCard";
import { studioApi, type StudioOverview } from "@/lib/studio/api";
import { newsletterDetailHref, useStudioPaths } from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

import { OverviewExpandableBody } from "./OverviewExpandableBody";
import { formatOverviewWhen, overviewInsetItemClassName } from "./overview-inset-styles";
import { StudioInsightSectionNav } from "./StudioInsightSectionNav";
import { StudioOverviewTopSection } from "./StudioOverviewTopSection";

export function StudioAnalyticsView() {
  const { schedule, templates, triggers, newsletters, subscribers } = useStudioPaths();
  const [data, setData] = useState<StudioOverview | null>(null);
  const [templateCount, setTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await studioApi.getOverview();
      setData(next);
    } catch {
      toast.error("Could not load Studio analytics — is hq/studio running on port 32831?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void studioApi
      .listMessageTemplates()
      .then((res) => setTemplateCount(res.templates.length))
      .catch(() => setTemplateCount(0));
  }, [data?.generatedAt]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="shrink-0 px-4 py-3"
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
        <div className="min-w-0 space-y-2">
          <StudioInsightSectionNav active="analytics" />
          <div className="space-y-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Send volume, engagement, triggers, and recent activity.
            </p>
          </div>
        </div>
      </DesktopTitleBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex flex-col gap-4")}>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading analytics…</p>
          ) : null}

          {data ? (
            <>
              <StudioOverviewTopSection
                data={data}
                paths={{ schedule, templates, triggers, newsletters, subscribers, templateCount }}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base">Recent newsletters</CardTitle>
                      <CardDescription>
                        {data.newsletters.draftCount} drafts · {data.newsletters.inProgressCount} in progress
                      </CardDescription>
                    </div>
                    <Link href={newsletters} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      All newsletters
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sent today (Studio)</span>
                          <span className="tabular-nums font-medium">
                            {data.newsletters.cloudflareQuota.usedToday}
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
                      {data.newsletters.recentSent.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No completed sends yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {data.newsletters.recentSent.map((row) => (
                            <li key={row.id}>
                              <Link
                                href={newsletterDetailHref(row.id, "stats", "sent")}
                                className={cn(overviewInsetItemClassName, "block")}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-medium">{row.name}</p>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatOverviewWhen(row.sentAt)}
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
                      <CardTitle className="text-base">Trigger activity</CardTitle>
                      <CardDescription>
                        {data.triggers.activeCount} active · {data.triggers.triggers24h} triggers / 24h
                      </CardDescription>
                    </div>
                    <Link href={triggers} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Triggers
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <OverviewExpandableBody>
                      {data.triggers.recentEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No trigger events yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {data.triggers.recentEvents.map((row) => (
                            <li
                              key={row.id}
                              className={cn(
                                overviewInsetItemClassName,
                                "flex items-start justify-between gap-2 text-sm",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{row.triggerName}</p>
                                <p className="truncate text-xs text-muted-foreground">{row.recipientEmail}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <Badge variant="secondary" className="text-[10px]">
                                  {row.status}
                                </Badge>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {formatOverviewWhen(row.occurredAt)}
                                </p>
                              </div>
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
                Analytics unavailable. Start hq/studio and refresh.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
