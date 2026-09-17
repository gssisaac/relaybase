"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NewsletterCloudflareLimitsAlertBanner,
  NewsletterCloudflareLimitsAlertShowButton,
} from "@/studio/components/newsletters/NewsletterCloudflareLimitsAlert";
import { NewsletterInProgressBodySkeleton } from "@/studio/components/newsletters/NewsletterLoadingSkeletons";
import { NewsletterSendingProgressPanel } from "@/studio/components/newsletters/NewsletterSendingProgressPanel";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { NewslettersSectionNav } from "@/studio/components/newsletters/NewslettersSectionNav";
import { newsletterDetailHref } from "@/studio/lib/paths";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { useNewslettersHub } from "@/studio/stores/newsletters-hub";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NewsletterInProgressView() {
  const hub = useNewslettersHub();
  const data = hub.inProgress;

  const load = useCallback(
    async (force?: boolean) => {
      try {
        await hub.refreshInProgress({ force });
      } catch {
        toast.error("Could not load in-progress newsletters");
      }
    },
    [hub],
  );

  useEffect(() => {
    void hub.refreshInProgress().catch(() => {
      toast.error("Could not load in-progress newsletters");
    });
    hub.beginInProgressPolling();
    return () => hub.endInProgressPolling();
  }, [hub]);

  const sendingCount = data?.sending.length ?? 0;
  const scheduledCount = data?.scheduled.length ?? 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <>
            <NewsletterCloudflareLimitsAlertShowButton />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={hub.inProgressFetching}
            >
              <RefreshCw className={hub.inProgressRefreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight">Newsletters</h1>
          <NewslettersSectionNav active="in-progress" />
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <NewsletterCloudflareLimitsAlertBanner />
          {hub.inProgressShowPlaceholder ? (
            <NewsletterInProgressBodySkeleton />
          ) : data ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {sendingCount > 0 ? (
                  <Badge variant="outline" className="gap-1 border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                    <Loader2 className="size-3 animate-spin" />
                    {sendingCount} sending
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {scheduledCount} scheduled
                </Badge>
              </div>

              {data.sending.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">No newsletters sending</CardTitle>
                    <CardDescription>
                      Concurrent sends appear here while the queue is draining. Scheduled newsletters
                      stay listed below until dispatch starts.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.sending.map((row) => (
                      <Card key={row.newsletter.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-sm">{row.newsletter.name}</CardTitle>
                              <CardDescription className="truncate">
                                {row.newsletter.subscriberGroupName ?? "No subscriber group"} ·{" "}
                                {row.newsletter.subject || "No subject"}
                              </CardDescription>
                            </div>
                            <NewsletterStatusBadge status={row.newsletter.status} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {row.dispatch ? (
                            <NewsletterSendingProgressPanel
                              compact
                              dispatch={row.dispatch}
                              action={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  nativeButton={false}
                                  render={
                                    <Link href={newsletterDetailHref(row.newsletter.id, "stats")} />
                                  }
                                >
                                  View stats
                                </Button>
                              }
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Started {formatWhen(row.startedAt)} · last batch{" "}
                              {formatWhen(row.lastDispatchedAt)}
                            </p>
                          )}
                          {row.recentEvents.length > 0 ? (
                            <div className="space-y-1">
                              {row.recentEvents.slice(0, 3).map((event) => (
                                <p key={event.id} className="truncate text-xs text-muted-foreground">
                                  {event.type} · {event.memberEmail}
                                  {event.reason ? ` · ${event.reason}` : ""}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          {!row.dispatch ? (
                            <Button
                              size="sm"
                              variant="outline"
                              nativeButton={false}
                              render={<Link href={newsletterDetailHref(row.newsletter.id, "stats")} />}
                            >
                              View stats
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Scheduled</CardTitle>
                  <CardDescription>
                    Upcoming dispatches. Subscribers resolve from the linked group at send time.
                  </CardDescription>
                </CardHeader>
                {data.scheduled.length === 0 ? (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No scheduled newsletters.</p>
                  </CardContent>
                ) : (
                  <CardContent className="divide-y divide-border p-0">
                    {data.scheduled.map((row) => (
                      <Link
                        key={row.id}
                        href={newsletterDetailHref(row.id, "publish")}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.subscriberGroupName ?? "No subscriber group"} · {row.subscriberActiveCount.toLocaleString()}{" "}
                            recipients
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <NewsletterStatusBadge status={row.status} />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatWhen(row.scheduledAt)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                )}
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
