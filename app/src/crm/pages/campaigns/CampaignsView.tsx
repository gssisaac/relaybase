"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { broadcastDetailFromSearch, campaignDetailFromSearch } from "@/crm/lib/paths";
import { BroadcastDetailProvider } from "@/crm/pages/campaigns/BroadcastDetailContext";
import { BroadcastDetailSwitch } from "@/crm/pages/campaigns/BroadcastDetailSwitch";
import { CampaignDetailProvider } from "@/crm/pages/campaigns/CampaignDetailContext";
import { CampaignDetailSwitch } from "@/crm/pages/campaigns/CampaignDetailSwitch";
import { CampaignsListView } from "@/crm/pages/campaigns/CampaignsListView";

/**
 * `?id=` / `?broadcastId=` switch, not `[id]`/`[broadcastId]` dynamic
 * segments — the packaged desktop build is a static export with no server
 * to resolve arbitrary ids at runtime, same reasoning as `/broadcasts?id=`
 * (see lib/navigation/sidebar-paths.ts normalizeEntryPath and
 * docs/features/audience-and-broadcasts.md).
 */
function CampaignsRoute() {
  const searchParams = useSearchParams();
  const broadcastDetail = broadcastDetailFromSearch(searchParams);
  const campaignDetail = campaignDetailFromSearch(searchParams);

  if (broadcastDetail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CampaignDetailProvider key={broadcastDetail.campaignId} campaignId={broadcastDetail.campaignId}>
          <BroadcastDetailProvider
            key={broadcastDetail.broadcastId}
            campaignId={broadcastDetail.campaignId}
            broadcastId={broadcastDetail.broadcastId}
          >
            <BroadcastDetailSwitch tab={broadcastDetail.tab} />
          </BroadcastDetailProvider>
        </CampaignDetailProvider>
      </div>
    );
  }

  if (campaignDetail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CampaignDetailProvider key={campaignDetail.campaignId} campaignId={campaignDetail.campaignId}>
          <CampaignDetailSwitch tab={campaignDetail.tab} />
        </CampaignDetailProvider>
      </div>
    );
  }

  return <CampaignsListView />;
}

export function CampaignsView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <CampaignsRoute />
    </Suspense>
  );
}
