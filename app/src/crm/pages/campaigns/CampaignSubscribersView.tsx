"use client";

import { RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { crmAudienceDetailHref, useCrmPaths } from "@/crm/lib/paths";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, type Subscriber, type SubscriberStatus } from "@/lib/crm/api";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<SubscriberStatus, string> = {
  subscribed: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "border-border bg-muted text-muted-foreground",
  pending: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bounced: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: SubscriberStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[status])}>
      {status}
    </Badge>
  );
}

export function CampaignSubscribersView() {
  const { campaignId, campaign, subscribers, refreshSubscribers, refresh } = useCampaignDetail();
  const { audience: audienceHref } = useCrmPaths();
  const [syncing, setSyncing] = useState(false);

  if (!campaign) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await crmApi.syncSubscribers(campaignId);
      toast.success(
        `Synced from audience: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped`,
      );
      await Promise.all([refreshSubscribers(), refresh()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleUnsubscribe(subscriber: Subscriber) {
    try {
      await crmApi.updateSubscriber(campaignId, subscriber.id, { status: "unsubscribed" });
      toast.success(`${subscriber.email} unsubscribed from this campaign`);
      await refreshSubscribers();
    } catch {
      toast.error("Could not update subscriber");
    }
  }

  const subscribedCount = subscribers.filter((s) => s.status === "subscribed").length;
  const groupId = campaign.audienceGroupId;
  const groupLabel = campaign.audienceGroupName ?? "Audience group";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Linked audience</CardTitle>
          <CardDescription>
            Subscribers are consent records for contacts in this audience group. Contact emails and
            names live in Audience — this campaign only tracks opt-in status per person.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {groupId ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{groupLabel}</p>
              <p className="truncate text-xs text-muted-foreground">
                {campaign.audienceGroupDomain ?? "—"}
                {campaign.audienceContactCount != null
                  ? ` · ${campaign.audienceContactCount.toLocaleString()} contacts`
                  : null}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No audience linked (legacy campaign).</p>
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
          <h2 className="text-sm font-semibold">Subscribers</h2>
          <p className="text-xs text-muted-foreground">
            {subscribedCount.toLocaleString()} active consent record{subscribedCount === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {subscribers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No subscribers yet</p>
            <p className="text-xs text-muted-foreground">
              Sync from the linked audience group to create consent records for its contacts.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void handleSync()} disabled={!groupId || syncing}>
              Sync from audience
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {subscribers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name || s.email}</p>
                  {s.name ? <p className="truncate text-xs text-muted-foreground">{s.email}</p> : null}
                  {s.status === "bounced" && s.bounceReason ? (
                    <p className="truncate text-xs text-destructive" title={s.bounceReason}>
                      {s.bounceReason}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={s.status} />
                <div className="flex shrink-0 items-center gap-1">
                  {s.status === "subscribed" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void handleUnsubscribe(s)}
                    >
                      Unsubscribe
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
