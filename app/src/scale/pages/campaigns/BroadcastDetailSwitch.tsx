"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  defaultBroadcastDetailTab,
  normalizeBroadcastDetailTab,
} from "@/scale/lib/broadcast-detail-nav";
import { broadcastDetailHref, useScalePaths, type BroadcastDetailTab } from "@/scale/lib/paths";
import { BroadcastRecipientsView } from "@/scale/pages/campaigns/CampaignSubscribersView";
import { BroadcastContentView } from "@/scale/pages/campaigns/BroadcastContentView";
import { BroadcastDetailShell } from "@/scale/pages/campaigns/BroadcastDetailShell";
import { BroadcastPublishView } from "@/scale/pages/campaigns/BroadcastPublishView";
import { BroadcastSettingsView } from "@/scale/pages/campaigns/CampaignSettingsView";
import { BroadcastStatsView } from "@/scale/pages/campaigns/BroadcastStatsView";
import { useBroadcastDetail } from "@/scale/pages/campaigns/CampaignDetailContext";

function BroadcastNotFound() {
  const { broadcasts } = useScalePaths();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            nativeButton={false}
            render={<Link href={broadcasts} />}
          >
            <ArrowLeft className="size-4" />
            Broadcasts
          </Button>
          <h1 className="truncate text-sm font-semibold">Broadcast not found</h1>
        </div>
      </DesktopTitleBar>
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This broadcast does not exist or was removed.
      </div>
    </div>
  );
}

export function BroadcastDetailSwitch({ tab }: { tab: BroadcastDetailTab | null }) {
  const router = useRouter();
  const { broadcastId, broadcast, loading, notFound } = useBroadcastDetail();

  const resolvedTab = broadcast
    ? normalizeBroadcastDetailTab(
        tab ?? defaultBroadcastDetailTab(broadcast.status),
        broadcast.status,
      )
    : tab ?? "content";

  useEffect(() => {
    if (!broadcast || tab === null) return;
    if (resolvedTab !== tab) {
      router.replace(broadcastDetailHref(broadcastId, resolvedTab, broadcast.status));
    }
  }, [broadcast, broadcastId, resolvedTab, router, tab]);

  if (loading && !broadcast) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !broadcast) return <BroadcastNotFound />;

  return (
    <BroadcastDetailShell section={resolvedTab} fill={resolvedTab === "content"}>
      {resolvedTab === "content" ? <BroadcastContentView /> : null}
      {resolvedTab === "publish" ? <BroadcastPublishView /> : null}
      {resolvedTab === "recipients" ? <BroadcastRecipientsView /> : null}
      {resolvedTab === "stats" ? <BroadcastStatsView /> : null}
      {resolvedTab === "settings" ? <BroadcastSettingsView /> : null}
    </BroadcastDetailShell>
  );
}
