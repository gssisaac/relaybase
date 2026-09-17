"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewsletterCloudflareSendingLimitsCard } from "@/studio/components/newsletters/NewsletterCloudflareSendingLimitsCard";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { NewslettersSectionNav } from "@/studio/components/newsletters/NewslettersSectionNav";
import { newsletterDetailHref } from "@/studio/lib/paths";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { studioApi, type AccountSentOverview } from "@/studio/api";

function rateLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeek(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NewsletterSentOverviewView() {
  const [data, setData] = useState<AccountSentOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    try {
      setData(await studioApi.getSentOverview());
    } catch {
      toast.error("Could not load sent statistics");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxWeek = Math.max(1, ...(data?.byWeek.map((w) => w.sent) ?? [1]));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight">Newsletters</h1>
          <NewslettersSectionNav active="sent" />
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <NewsletterCloudflareSendingLimitsCard />
          {!data ? (
            <p className="text-sm text-muted-foreground">Loading sent statistics…</p>
          ) : data.totals.newsletters === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">No sent newsletters yet</CardTitle>
                <CardDescription>
                  Account-wide delivery and engagement appear after the first send finishes.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {formatWhen(data.period.from)} – {formatWhen(data.period.to)} ·{" "}
                {data.totals.newsletters} newsletters
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardDescription>Delivered</CardDescription>
                    <CardTitle className="tabular-nums">
                      {data.totals.delivered.toLocaleString()}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({rateLabel(data.rates.delivery)})
                      </span>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Open rate</CardDescription>
                    <CardTitle className="tabular-nums">
                      {rateLabel(data.rates.open)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {data.totals.opened.toLocaleString()} unique
                      </span>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Click rate</CardDescription>
                    <CardTitle className="tabular-nums">
                      {rateLabel(data.rates.click)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {data.totals.clicked.toLocaleString()} unique
                      </span>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Bounce / unsub / complaint</CardDescription>
                    <CardTitle className="text-base tabular-nums">
                      {data.totals.bounced}{" "}
                      <span className="text-sm font-normal text-muted-foreground">bounce</span> ·{" "}
                      {data.totals.unsubscribed}{" "}
                      <span className="text-sm font-normal text-muted-foreground">unsub</span> ·{" "}
                      {data.totals.complained}{" "}
                      <span className="text-sm font-normal text-muted-foreground">spam</span>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {data.byWeek.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Weekly volume</CardTitle>
                    <CardDescription>Sent attempts, unique opens, and unique clicks by week.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex h-28 items-end gap-2">
                      {data.byWeek.map((week) => {
                        const height = Math.max(8, (week.sent / maxWeek) * 100);
                        return (
                          <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full rounded-sm bg-primary/80"
                              style={{ height: `${height}%` }}
                              title={`${week.sent} sent · ${week.opened} opened · ${week.clicked} clicked`}
                            />
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {formatWeek(week.weekStart)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {data.bySubscriberGroup.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">By subscriber group</CardTitle>
                    <CardDescription>Contribution of each linked group across finished sends.</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-border p-0">
                    {data.bySubscriberGroup.map((row) => (
                      <div
                        key={row.subscriberGroupId}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <p className="min-w-0 truncate font-medium">{row.name}</p>
                        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.sent.toLocaleString()} sent · {row.opened} opened · {row.clicked} clicked
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Broadcasts</CardTitle>
                  <CardDescription>Finished sends, newest first. Open a row for per-newsletter stats.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border p-0">
                  {data.newsletters.map((row) => (
                    <Link
                      key={row.id}
                      href={newsletterDetailHref(row.id, "stats")}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{row.name}</p>
                          <NewsletterStatusBadge status={row.status} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.subscriberGroupName ?? "No subscriber group"} · {row.subject || "No subject"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        <p>{formatWhen(row.finishedAt ?? row.sentAt)}</p>
                        <p>
                          {row.stats.delivered} delivered · {row.stats.opened} opened · {row.stats.clicked}{" "}
                          clicked
                        </p>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {data.topLinks.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Top links</CardTitle>
                    <CardDescription>Tracked clicks across finished newsletters.</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-border p-0">
                    {data.topLinks.map((row) => (
                      <div
                        key={`${row.newsletterId}:${row.url}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-primary hover:underline"
                        >
                          <span className="truncate">{row.url}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-60" />
                        </a>
                        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.clicks} clicks · {row.uniqueClicks} unique
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
