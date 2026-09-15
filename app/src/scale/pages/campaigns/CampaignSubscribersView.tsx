"use client";

import { RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scaleAudienceDetailHref, useScalePaths } from "@/scale/lib/paths";
import { useBroadcastDetail } from "@/scale/pages/campaigns/CampaignDetailContext";
import { scaleApi, type BroadcastMemberStatus } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BroadcastMemberStatus, string> = {
  active: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "border-border bg-muted text-muted-foreground",
  bounced: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: BroadcastMemberStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[status])}>
      {status === "active" ? "subscribed" : status}
    </Badge>
  );
}

export function BroadcastRecipientsView() {
  const { broadcastId, broadcast, audienceMembers, refreshAudience, refresh } = useBroadcastDetail();
  const { audience: audienceHref } = useScalePaths();
  const [syncing, setSyncing] = useState(false);

  if (!broadcast) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await scaleApi.syncBroadcastAudience(broadcastId);
      toast.success(
        `Recipients refreshed: ${result.contactCount ?? 0} contacts (${result.activeCount ?? 0} active)`,
      );
      await Promise.all([refreshAudience(), refresh()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const activeCount = audienceMembers.filter((m) => m.status === "active").length;
  const groupId = broadcast.audienceGroupId;
  const groupLabel = broadcast.audienceGroupName ?? "Audience group";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Linked audience</CardTitle>
          <CardDescription>
            Recipients are resolved from the linked audience group at send time. To unsubscribe a
            contact, use Audience — not this read-only list.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {groupId ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{groupLabel}</p>
              <p className="truncate text-xs text-muted-foreground">
                {broadcast.audienceGroupDomain ?? "—"}
                {broadcast.audienceContactCount != null
                  ? ` · ${broadcast.audienceContactCount.toLocaleString()} contacts`
                  : null}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No audience linked.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={groupId ? scaleAudienceDetailHref(groupId) : audienceHref} />
              }
            >
              Manage audience
            </Button>
            <Button size="sm" onClick={() => void handleSync()} disabled={syncing || !groupId}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              Refresh recipients
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Recipients</h2>
          <p className="text-xs text-muted-foreground">
            {activeCount.toLocaleString()} active recipient{activeCount === 1 ? "" : "s"} at send time
            (unsubscribed and bounced are excluded).
          </p>
        </div>
      </div>

      {audienceMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No recipients in linked group</p>
            <p className="text-xs text-muted-foreground">
              Add contacts in Audience, then refresh recipients.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void handleSync()} disabled={!groupId || syncing}>
              Refresh recipients
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {audienceMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name || m.email}</p>
                  {m.name ? <p className="truncate text-xs text-muted-foreground">{m.email}</p> : null}
                  {m.status === "bounced" && m.bounceReason ? (
                    <p className="truncate text-xs text-destructive" title={m.bounceReason}>
                      {m.bounceReason}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** @deprecated use BroadcastRecipientsView */
export const BroadcastAudienceView = BroadcastRecipientsView;

/** @deprecated use BroadcastRecipientsView */
export const CampaignSubscribersView = BroadcastRecipientsView;
