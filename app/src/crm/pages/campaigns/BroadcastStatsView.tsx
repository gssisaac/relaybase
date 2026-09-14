"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, type BroadcastRecipient, type RecipientStatus } from "@/lib/crm/api";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<RecipientStatus, string> = {
  queued: "border-border bg-muted text-muted-foreground",
  sending: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  sent: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  skipped: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function BroadcastStatsView() {
  const { broadcastId, broadcast } = useBroadcastDetail();
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    crmApi
      .getBroadcastStats(broadcastId)
      .then(({ recipients: rows }) => {
        if (!cancelled) setRecipients(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [broadcastId]);

  if (!broadcast) return null;

  const { sent, opened, clicked, failed } = broadcast.stats;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Stats</h2>
        <p className="text-xs text-muted-foreground">Delivery progress, opens, clicks, and the recipient log.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Sent</CardDescription>
            <CardTitle className="tabular-nums">
              {sent} <span className="text-sm font-normal text-muted-foreground">({rate(sent, sent)})</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Opens</CardDescription>
            <CardTitle className="tabular-nums">
              {opened}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({rate(opened, sent)} unique open rate)
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
                ({rate(clicked, sent)} click-through rate)
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failed</CardDescription>
            <CardTitle className="tabular-nums">
              {failed} <span className="text-sm font-normal text-muted-foreground">({rate(failed, sent + failed)})</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : recipients.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No recipients yet.</p>
          ) : (
            recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name || r.email}</p>
                  {r.name ? <p className="truncate text-xs text-muted-foreground">{r.email}</p> : null}
                  {r.status === "failed" && r.errorMessage ? (
                    <p className="truncate text-xs text-destructive" title={r.errorMessage}>
                      {r.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {r.openCount > 0 ? <span>{r.openCount} open{r.openCount === 1 ? "" : "s"}</span> : null}
                  {r.clickCount > 0 ? <span>{r.clickCount} click{r.clickCount === 1 ? "" : "s"}</span> : null}
                </div>
                <Badge variant="outline" className={cn("shrink-0 text-[10px] capitalize", STATUS_STYLE[r.status])}>
                  {r.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
