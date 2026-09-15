"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  campaignDetailFromSearch,
  campaignsSectionFromLocation,
} from "@/scale/lib/paths";
import { CampaignDetailProvider } from "@/scale/pages/campaigns/CampaignDetailContext";
import { CampaignDetailSwitch } from "@/scale/pages/campaigns/CampaignDetailSwitch";
import { CampaignInProgressView } from "@/scale/pages/campaigns/CampaignInProgressView";
import { CampaignSentOverviewView } from "@/scale/pages/campaigns/CampaignSentOverviewView";
import { CampaignsListView } from "@/scale/pages/campaigns/CampaignsListView";

function CampaignsRoute() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const detail = campaignDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CampaignDetailProvider key={detail.campaignId} campaignId={detail.campaignId}>
          <CampaignDetailSwitch tab={detail.tab} />
        </CampaignDetailProvider>
      </div>
    );
  }

  const section = campaignsSectionFromLocation(pathname, searchParams);
  if (section === "sent") return <CampaignSentOverviewView />;
  if (section === "in-progress") return <CampaignInProgressView />;
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
