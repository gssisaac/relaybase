"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BroadcastCloudflareSendingLimitsCard } from "@/crm/components/BroadcastCloudflareSendingLimitsCard";
import { BroadcastSendingProgressPanel } from "@/crm/components/BroadcastSendingProgressPanel";
import { BroadcastStatusBadge } from "@/crm/components/BroadcastStatusBadge";
import { BroadcastsSectionNav } from "@/crm/components/BroadcastsSectionNav";
import { broadcastDetailHref } from "@/crm/lib/paths";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { crmApi, type InProgressOverview } from "@/lib/crm/api";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BroadcastInProgressView() {
  const [data, setData] = useState<InProgressOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    try {
      setData(await crmApi.getInProgressOverview());
    } catch {
      toast.error("Could not load in-progress broadcasts");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const sendingCount = data?.sending.length ?? 0;
  const scheduledCount = data?.scheduled.length ?? 0;

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
        <div className="min-w-0 space-y-2">
          <h1 className="truncate text-lg font-semibold tracking-tight">In progress</h1>
          <BroadcastsSectionNav active="in-progress" />
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <BroadcastCloudflareSendingLimitsCard />
          {!data ? (
            <p className="text-sm text-muted-foreground">Loading in-progress broadcasts…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="gap-1 border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                  <Loader2 className="size-3 animate-spin" />
                  {sendingCount} sending
                </Badge>
                <Badge variant="outline" className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {scheduledCount} scheduled
                </Badge>
              </div>

              {data.sending.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">No broadcasts sending</CardTitle>
                    <CardDescription>
                      Concurrent sends appear here while the queue is draining. Scheduled broadcasts
                      stay listed below until dispatch starts.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.sending.map((row) => (
                      <Card key={row.broadcast.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-sm">{row.broadcast.name}</CardTitle>
                              <CardDescription className="truncate">
                                {row.broadcast.audienceGroupName ?? "No audience"} ·{" "}
                                {row.broadcast.subject || "No subject"}
                              </CardDescription>
                            </div>
                            <BroadcastStatusBadge status={row.broadcast.status} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {row.dispatch ? (
                            <BroadcastSendingProgressPanel
                              compact
                              dispatch={row.dispatch}
                              action={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  nativeButton={false}
                                  render={
                                    <Link href={broadcastDetailHref(row.broadcast.id, "stats")} />
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
                              render={<Link href={broadcastDetailHref(row.broadcast.id, "stats")} />}
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
                    Upcoming dispatches. Recipients resolve from the linked audience at send time.
                  </CardDescription>
                </CardHeader>
                {data.scheduled.length === 0 ? (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No scheduled broadcasts.</p>
                  </CardContent>
                ) : (
                  <CardContent className="divide-y divide-border p-0">
                    {data.scheduled.map((row) => (
                      <Link
                        key={row.id}
                        href={broadcastDetailHref(row.id, "publish")}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.audienceGroupName ?? "No audience"} · {row.audienceActiveCount.toLocaleString()}{" "}
                            recipients
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <BroadcastStatusBadge status={row.status} />
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
          )}
        </div>
      </div>
    </div>
  );
}
