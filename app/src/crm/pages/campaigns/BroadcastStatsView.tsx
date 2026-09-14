"use client";

import { Download, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BroadcastStatusBadge } from "@/crm/components/BroadcastStatusBadge";
import { broadcastDetailHref } from "@/crm/lib/paths";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import {
  crmApi,
  type BroadcastLinkClickStat,
  type BroadcastRecipient,
  type BroadcastTrackingEvent,
} from "@/lib/crm/api";

const EVENT_LABEL: Record<BroadcastTrackingEvent["type"], string> = {
  delivered: "Delivered",
  open: "Opened",
  click: "Clicked",
  bounce: "Bounced",
  unsubscribe: "Unsubscribed",
  complaint: "Complaint",
};

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function downloadRecipientsCsv(
  broadcastName: string,
  recipients: BroadcastRecipient[],
): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "email",
    "name",
    "status",
    "sent_at",
    "delivered_at",
    "opened_at",
    "clicked_at",
    "unsubscribed_at",
    "open_count",
    "click_count",
    "error",
  ].join(",");
  const rows = recipients.map((r) =>
    [
      r.email,
      r.name ?? "",
      r.status,
      r.sentAt ?? "",
      r.deliveredAt ?? "",
      r.openedAt ?? "",
      r.clickedAt ?? "",
      r.unsubscribedAt ?? "",
      String(r.openCount),
      String(r.clickCount),
      r.errorMessage ?? r.bounceReason ?? "",
    ]
      .map((cell) => escape(cell))
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${broadcastName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "broadcast"}-recipients.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BroadcastStatsView() {
  const { broadcastId, broadcast, setBroadcast } = useBroadcastDetail();
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<BroadcastTrackingEvent[]>([]);
  const [linkClicks, setLinkClicks] = useState<BroadcastLinkClickStat[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadStats = () => {
      crmApi
        .getBroadcastStats(broadcastId)
        .then(({ broadcast: row, recipients: rows, trackingEvents: events, linkClicks: links }) => {
          if (cancelled) return;
          setBroadcast(row);
          setRecipients(rows);
          setTrackingEvents(events);
          setLinkClicks(links);
        })
        .catch(() => {});
    };

    loadStats();

    let interval: ReturnType<typeof setInterval> | null = null;
    if (broadcast?.status === "sending") {
      interval = setInterval(loadStats, 3000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [broadcastId, broadcast?.status, setBroadcast]);

  const stats = broadcast?.stats;
  const hasSendData = Boolean(stats && (stats.sent > 0 || recipients.length > 0));
  const deliveryBase = stats ? stats.sent || stats.delivered + stats.bounced + stats.failed : 0;

  const opensByHour = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const r of recipients) {
      if (!r.openedAt) continue;
      const hour = new Date(r.openedAt).getHours();
      buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  }, [recipients]);

  if (!broadcast) return null;

  if (!hasSendData && broadcast.status === "scheduled") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Scheduled Broadcast</CardTitle>
              <CardDescription>
                This broadcast is scheduled for {formatWhen(broadcast.scheduledAt)}.
                Delivery and engagement metrics will update in real time once dispatch begins.
              </CardDescription>
            </div>
            <BroadcastStatusBadge
              status={broadcast.status}
              listStatus={broadcast.listStatus}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={broadcastDetailHref(broadcastId, "publish")} />}
          >
            Manage schedule
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hasSendData && broadcast.status === "draft") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No send data yet</CardTitle>
          <CardDescription>
            Stats appear after you send or schedule this broadcast. Compose content, then publish to
            your audience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" nativeButton={false} render={<Link href={broadcastDetailHref(broadcastId, "publish")} />} >
            Go to Publish
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const {
    sent,
    delivered,
    bounced,
    opened,
    totalOpens,
    clicked,
    totalClicks,
    failed,
    unsubscribed,
  } = stats;

  const processedCount = delivered + bounced + failed;
  const totalRecipients = recipients.length || broadcast.audienceActiveCount || sent;

  return (
    <div className="space-y-4">
      {broadcast.status === "sending" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-sky-600 dark:text-sky-400" />
              <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
                Sending in progress…
              </p>
            </div>
            <p className="text-xs text-sky-800/90 dark:text-sky-300">
              Processed {processedCount} of {totalRecipients} recipients (
              {rate(processedCount, totalRecipients)} complete)
            </p>
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-sky-200 dark:bg-sky-950">
            <div
              className="h-full bg-sky-600 transition-all duration-300 dark:bg-sky-400"
              style={{
                width: `${totalRecipients ? Math.min(100, Math.round((processedCount / totalRecipients) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Stats</h2>
            <BroadcastStatusBadge
              status={broadcast.status}
              listStatus={broadcast.listStatus}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {broadcast.status === "sending"
              ? `Sending in progress since ${formatWhen(broadcast.sentAt)} · ${processedCount} of ${totalRecipients} processed`
              : broadcast.sentAt
                ? `Sent ${formatWhen(broadcast.sentAt)} · ${sent} attempts`
                : "Delivery and engagement for this broadcast."}
          </p>
        </div>
        {recipients.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadRecipientsCsv(broadcast.name, recipients)}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Delivered</CardDescription>
            <CardTitle className="tabular-nums">
              {delivered}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({rate(delivered, deliveryBase)} delivery rate)
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Opens</CardDescription>
            <CardTitle className="tabular-nums">
              {opened}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({rate(opened, delivered)} unique · {totalOpens} total)
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clicks</CardDescription>
            <CardTitle className="tabular-nums">
              {clicked}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({rate(clicked, delivered)} CTR · {totalClicks} total)
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Bounced / Failed / Unsub</CardDescription>
            <CardTitle className="tabular-nums text-base">
              {bounced}{" "}
              <span className="text-sm font-normal text-muted-foreground">bounce</span> · {failed}{" "}
              <span className="text-sm font-normal text-muted-foreground">fail</span> ·{" "}
              {unsubscribed}{" "}
              <span className="text-sm font-normal text-muted-foreground">unsub</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {opensByHour.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Opens by hour (local)</CardTitle>
            <CardDescription>First-open timestamps grouped by hour of day.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-end gap-1">
              {opensByHour.map(([hour, count]) => {
                const max = Math.max(...opensByHour.map(([, c]) => c));
                const height = max ? Math.max(8, (count / max) * 100) : 8;
                return (
                  <div key={hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-primary/80"
                      style={{ height: `${height}%` }}
                      title={`${count} open${count === 1 ? "" : "s"}`}
                    />
                    <span className="text-[10px] tabular-nums text-muted-foreground">{hour}h</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {linkClicks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Link performance</CardTitle>
            <CardDescription>Tracked clicks from this send (redirect URLs in email body).</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {linkClicks.map((row) => (
              <div key={row.url} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-primary hover:underline"
                >
                  <span className="truncate">{row.url}</span>
                  <ExternalLink className="size-3 shrink-0 opacity-60" />
                </a>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p className="tabular-nums font-medium text-foreground">{row.clicks} clicks</p>
                  <p>{row.uniqueClicks} unique</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {trackingEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activity</CardTitle>
            <CardDescription>
              Per-recipient delivery and engagement events (opens, clicks, bounces, unsubscribes).
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {trackingEvents.slice(0, 50).map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{event.memberEmail}</p>
                  {event.url ? (
                    <p className="truncate text-xs text-muted-foreground">{event.url}</p>
                  ) : event.reason ? (
                    <p className="truncate text-xs text-muted-foreground">{event.reason}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {EVENT_LABEL[event.type]}
                  </Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatWhen(event.occurredAt)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
