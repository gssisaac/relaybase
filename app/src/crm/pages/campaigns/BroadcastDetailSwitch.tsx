"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { useCrmPaths, type BroadcastDetailTab } from "@/crm/lib/paths";
import { BroadcastRecipientsView } from "@/crm/pages/campaigns/CampaignSubscribersView";
import { BroadcastContentView } from "@/crm/pages/campaigns/BroadcastContentView";
import { BroadcastDetailShell } from "@/crm/pages/campaigns/BroadcastDetailShell";
import { BroadcastPublishView } from "@/crm/pages/campaigns/BroadcastPublishView";
import { BroadcastSettingsView } from "@/crm/pages/campaigns/CampaignSettingsView";
import { BroadcastStatsView } from "@/crm/pages/campaigns/BroadcastStatsView";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";

function BroadcastNotFound() {
  const { broadcasts } = useCrmPaths();
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

export function BroadcastDetailSwitch({ tab }: { tab: BroadcastDetailTab }) {
  const { broadcast, loading, notFound } = useBroadcastDetail();

  if (loading && !broadcast) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !broadcast) return <BroadcastNotFound />;

  return (
    <BroadcastDetailShell section={tab} fill={tab === "content"}>
      {tab === "content" ? <BroadcastContentView /> : null}
      {tab === "publish" ? <BroadcastPublishView /> : null}
      {tab === "recipients" ? <BroadcastRecipientsView /> : null}
      {tab === "stats" ? <BroadcastStatsView /> : null}
      {tab === "settings" ? <BroadcastSettingsView /> : null}
    </BroadcastDetailShell>
  );
}
