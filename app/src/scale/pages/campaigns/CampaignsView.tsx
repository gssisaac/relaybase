"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  broadcastDetailFromSearch,
  broadcastsSectionFromLocation,
} from "@/scale/lib/paths";
import { BroadcastDetailProvider } from "@/scale/pages/campaigns/CampaignDetailContext";
import { BroadcastDetailSwitch } from "@/scale/pages/campaigns/BroadcastDetailSwitch";
import { BroadcastInProgressView } from "@/scale/pages/campaigns/BroadcastInProgressView";
import { BroadcastSentOverviewView } from "@/scale/pages/campaigns/BroadcastSentOverviewView";
import { BroadcastsListView } from "@/scale/pages/campaigns/CampaignsListView";

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
