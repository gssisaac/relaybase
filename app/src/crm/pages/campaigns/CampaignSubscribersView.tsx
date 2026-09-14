"use client";

import { RefreshCw, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { crmAudienceDetailHref, useCrmPaths } from "@/crm/lib/paths";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, type BroadcastMember, type BroadcastMemberStatus } from "@/lib/crm/api";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BroadcastMemberStatus, string> = {
  active: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "border-border bg-muted text-muted-foreground",
  pending: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bounced: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: BroadcastMemberStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[status])}>
      {status === "active" ? "subscribed" : status}
    </Badge>
  );
}

export function BroadcastAudienceView() {
  const { broadcastId, broadcast, audienceMembers, refreshAudience, refresh } = useBroadcastDetail();
  const { audience: audienceHref } = useCrmPaths();
  const [syncing, setSyncing] = useState(false);

  if (!broadcast) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await crmApi.syncBroadcastAudience(broadcastId);
      toast.success(
        `Synced from audience: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped`,
      );
      await Promise.all([refreshAudience(), refresh()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAdminUnsubscribe(member: BroadcastMember) {
    try {
      await crmApi.updateBroadcastAudienceMember(broadcastId, member.id, { status: "unsubscribed" });
      toast.success(`${member.email} marked unsubscribed`);
      await refreshAudience();
    } catch {
      toast.error("Could not update audience member");
    }
  }

  async function handleRemove(member: BroadcastMember) {
    try {
      await crmApi.removeBroadcastAudienceMember(broadcastId, member.id);
      toast.success(`${member.email} removed from this broadcast`);
      await refreshAudience();
    } catch {
      toast.error("Could not remove audience member");
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
            Contacts live in Audience groups. This broadcast tracks send eligibility per contact —
            user unsubscribes stay on the list as unsubscribed; admin remove deletes the row.
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
                <Link href={groupId ? crmAudienceDetailHref(groupId) : audienceHref} />
              }
            >
              Manage audience
            </Button>
            <Button size="sm" onClick={() => void handleSync()} disabled={syncing || !groupId}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              Sync from audience
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Broadcast audience</h2>
          <p className="text-xs text-muted-foreground">
            {activeCount.toLocaleString()} active send target{activeCount === 1 ? "" : "s"} (unsubscribed
            contacts are excluded at send time).
          </p>
        </div>
      </div>

      {audienceMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No audience members yet</p>
            <p className="text-xs text-muted-foreground">
              Sync from the linked audience group to attach contacts to this broadcast.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void handleSync()} disabled={!groupId || syncing}>
              Sync from audience
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
                <div className="flex shrink-0 items-center gap-1">
                  {m.status === "active" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void handleAdminUnsubscribe(m)}
                    >
                      Unsubscribe
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive"
                    onClick={() => void handleRemove(m)}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** @deprecated use BroadcastAudienceView */
export const CampaignSubscribersView = BroadcastAudienceView;
