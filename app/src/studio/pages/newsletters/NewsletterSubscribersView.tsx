"use client";

import { RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { studioSubscriberDetailHref, useStudioPaths } from "@/studio/lib/paths";
import { useNewsletterDetail } from "@/studio/stores/newsletter-detail";
import { studioApi, type NewsletterMemberStatus } from "@/studio/api";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<NewsletterMemberStatus, string> = {
  active: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "border-border bg-muted text-muted-foreground",
  bounced: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: NewsletterMemberStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[status])}>
      {status === "active" ? "subscribed" : status}
    </Badge>
  );
}

export function NewsletterSubscribersView() {
  const { newsletterId, newsletter, subscriberMembers, refreshSubscribers, refresh } = useNewsletterDetail();
  const { subscribers: subscribersHref } = useStudioPaths();
  const [syncing, setSyncing] = useState(false);

  if (!newsletter) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await studioApi.syncNewsletterSubscribers(newsletterId);
      toast.success(
        `Subscribers refreshed: ${result.contactCount ?? 0} contacts (${result.activeCount ?? 0} active)`,
      );
      await Promise.all([refreshSubscribers(), refresh()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const activeCount = subscriberMembers.filter((m) => m.status === "active").length;
  const groupId = newsletter.subscriberGroupId;
  const groupLabel = newsletter.subscriberGroupName ?? "Subscriber group";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Linked subscriber group</CardTitle>
          <CardDescription>
            Subscribers are resolved from the linked group at send time. To unsubscribe a contact,
            use Subscribers — not this read-only list.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {groupId ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{groupLabel}</p>
              <p className="truncate text-xs text-muted-foreground">
                {newsletter.subscriberGroupDomain ?? "—"}
                {newsletter.subscriberContactCount != null
                  ? ` · ${newsletter.subscriberContactCount.toLocaleString()} contacts`
                  : null}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subscriber group linked.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={groupId ? studioSubscriberDetailHref(groupId) : subscribersHref} />
              }
            >
              Manage subscribers
            </Button>
            <Button size="sm" onClick={() => void handleSync()} disabled={syncing || !groupId}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              Refresh subscribers
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Send list</h2>
          <p className="text-xs text-muted-foreground">
            {activeCount.toLocaleString()} active subscriber{activeCount === 1 ? "" : "s"} at send time
            (unsubscribed and bounced are excluded).
          </p>
        </div>
      </div>

      {subscriberMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No subscribers in linked group</p>
            <p className="text-xs text-muted-foreground">
              Add subscribers in Subscribers, then refresh the send list.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void handleSync()} disabled={!groupId || syncing}>
              Refresh subscribers
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {subscriberMembers.map((m) => (
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
