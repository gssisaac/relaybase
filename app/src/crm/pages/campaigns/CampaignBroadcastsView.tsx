"use client";

import { Mail, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { broadcastDetailHref } from "@/crm/lib/paths";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, type Broadcast } from "@/lib/crm/api";

const STATUS_VARIANT: Record<
  Broadcast["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
};

function statsLine(b: Broadcast): string {
  if (b.status === "sent" || b.status === "sending" || b.stats.sent > 0) {
    return `${b.stats.sent} sent · ${b.stats.opened} opened`;
  }
  if (b.status === "scheduled" && b.scheduledAt) {
    return `Scheduled for ${new Date(b.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }
  return "Draft";
}

export function CampaignBroadcastsView() {
  const router = useRouter();
  const { campaignId, campaign, broadcasts } = useCampaignDetail();
  const [creating, setCreating] = useState(false);

  if (!campaign) return null;

  async function handleCreate() {
    setCreating(true);
    try {
      const broadcast = await crmApi.createBroadcast(campaignId);
      router.push(broadcastDetailHref(campaignId, broadcast.id, "content"));
    } catch {
      toast.error("Could not create broadcast");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Broadcasts</h2>
          <p className="text-xs text-muted-foreground">
            Independent calendar sends within this campaign — each is its own subject and body.
          </p>
        </div>
        <Button size="sm" onClick={() => void handleCreate()} disabled={creating}>
          <Plus className="size-4" />
          New broadcast
        </Button>
      </div>

      {broadcasts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Mail className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No broadcasts yet</p>
            <p className="text-xs text-muted-foreground">
              Create a draft and write your first send to this campaign&apos;s subscribers.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void handleCreate()} disabled={creating}>
              New broadcast
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {broadcasts.map((b) => (
              <Link
                key={b.id}
                href={broadcastDetailHref(
                  campaignId,
                  b.id,
                  b.status === "sent" ? "stats" : b.status === "draft" ? "content" : "publish",
                )}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.subject?.trim() || "Untitled draft"}</p>
                  <p className="truncate text-xs text-muted-foreground">{statsLine(b)}</p>
                </div>
                <Badge variant={STATUS_VARIANT[b.status]} className="shrink-0 text-[10px] capitalize">
                  {b.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
