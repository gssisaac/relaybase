"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  broadcastDetailFromSearch,
  broadcastsSectionFromLocation,
} from "@/crm/lib/paths";
import { BroadcastDetailProvider } from "@/crm/pages/campaigns/CampaignDetailContext";
import { BroadcastDetailSwitch } from "@/crm/pages/campaigns/BroadcastDetailSwitch";
import { BroadcastInProgressView } from "@/crm/pages/campaigns/BroadcastInProgressView";
import { BroadcastSentOverviewView } from "@/crm/pages/campaigns/BroadcastSentOverviewView";
import { BroadcastsListView } from "@/crm/pages/campaigns/CampaignsListView";

function BroadcastsRoute() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
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

  const section = broadcastsSectionFromLocation(pathname, searchParams);
  if (section === "sent") return <BroadcastSentOverviewView />;
  if (section === "in-progress") return <BroadcastInProgressView />;
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
