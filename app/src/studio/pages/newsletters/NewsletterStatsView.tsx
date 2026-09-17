"use client";

import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewsletterSendingProgressPanel } from "@/studio/components/newsletters/NewsletterSendingProgressPanel";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { newsletterDetailHref } from "@/studio/lib/paths";
import {
  useNewsletterDetail,
  useNewsletterDetailStats,
} from "@/studio/stores/NewsletterDetailContext";
import type {
  NewsletterLinkClickStat,
  NewsletterRecipient,
  NewsletterTrackingEvent,
} from "@/lib/studio/api";

const EVENT_LABEL: Record<NewsletterTrackingEvent["type"], string> = {
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
  newsletterName: string,
  recipients: NewsletterRecipient[],
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
  a.download = `${newsletterName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "newsletter"}-recipients.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function NewsletterStatsView() {
  const { newsletterId, newsletter } = useNewsletterDetail();
  const { recipients, trackingEvents, linkClicks, dispatch } = useNewsletterDetailStats();

  const stats = newsletter?.stats;
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

  if (!newsletter) return null;

  if (!hasSendData && newsletter.status === "scheduled") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Scheduled Newsletter</CardTitle>
              <CardDescription>
                This newsletter is scheduled for {formatWhen(newsletter.scheduledAt ?? "")}.
                Delivery and engagement metrics will update in real time once dispatch begins.
              </CardDescription>
            </div>
            <NewsletterStatusBadge
              status={newsletter.status}
              listStatus={newsletter.listStatus}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={newsletterDetailHref(newsletterId, "publish")} />}
          >
            Manage schedule
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hasSendData && newsletter.status === "draft") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No send data yet</CardTitle>
          <CardDescription>
            Stats appear after you send or schedule this newsletter. Compose content, then publish to
            your audience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" nativeButton={false} render={<Link href={newsletterDetailHref(newsletterId, "publish")} />} >
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
    skipped = 0,
    complained = 0,
    unsubscribed,
  } = stats;

  const processedCount = delivered + bounced + failed;
  const totalRecipients = recipients.length || newsletter.audienceActiveCount || sent;

  return (
    <div className="space-y-4">
      {newsletter.status === "sending" && dispatch ? (
        <NewsletterSendingProgressPanel dispatch={dispatch} />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Stats</h2>
            <NewsletterStatusBadge
              status={newsletter.status}
              listStatus={newsletter.listStatus}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {newsletter.status === "sending"
              ? `Sending in progress since ${formatWhen(newsletter.sentAt ?? "")} · ${processedCount} of ${totalRecipients} processed`
              : newsletter.sentAt
                ? `Sent ${formatWhen(newsletter.sentAt ?? "")} · ${sent} attempts`
                : "Delivery and engagement for this newsletter."}
          </p>
        </div>
        {recipients.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadRecipientsCsv(newsletter.name, recipients)}
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
            <CardDescription>Bounce / fail / skip / unsub</CardDescription>
            <CardTitle className="tabular-nums text-base">
              {bounced}{" "}
              <span className="text-sm font-normal text-muted-foreground">bounce</span> · {failed}{" "}
              <span className="text-sm font-normal text-muted-foreground">fail</span> · {skipped}{" "}
              <span className="text-sm font-normal text-muted-foreground">skip</span> ·{" "}
              {unsubscribed}{" "}
              <span className="text-sm font-normal text-muted-foreground">unsub</span>
              {complained ? (
                <>
                  {" "}
                  · {complained}{" "}
                  <span className="text-sm font-normal text-muted-foreground">spam</span>
                </>
              ) : null}
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

      {(() => {
        const issues = recipients.filter(
          (r) => r.status === "failed" || r.status === "skipped" || r.status === "bounced",
        );
        if (issues.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivery issues</CardTitle>
              <CardDescription>
                Failed, skipped, and bounced recipients with error detail from this send.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {issues.slice(0, 100).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.errorMessage ?? r.bounceReason ?? "No detail recorded"}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {r.status}
                  </Badge>
                </div>
              ))}
              {issues.length > 100 ? (
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  Showing first 100 of {issues.length} — use Export CSV for the full list.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })()}

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
