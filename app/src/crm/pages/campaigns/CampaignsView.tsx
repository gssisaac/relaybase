"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { broadcastDetailFromSearch } from "@/crm/lib/paths";
import { BroadcastDetailProvider } from "@/crm/pages/campaigns/CampaignDetailContext";
import { BroadcastDetailSwitch } from "@/crm/pages/campaigns/BroadcastDetailSwitch";
import { BroadcastsListView } from "@/crm/pages/campaigns/CampaignsListView";

function BroadcastsRoute() {
  const searchParams = useSearchParams();
  const detail = broadcastDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <BroadcastDetailProvider key={detail.broadcastId} broadcastId={detail.broadcastId}>
          <BroadcastDetailSwitch tab={detail.tab} />
        </BroadcastDetailProvider>
      </div>
    );
  }

  return <BroadcastsListView />;
}

export function BroadcastsView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <BroadcastsRoute />
    </Suspense>
  );
}

/** @deprecated use BroadcastsView */
export const CampaignsView = BroadcastsView;
