"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { campaignDetailFromSearch } from "@/crm/lib/paths";
import { CampaignDetailProvider } from "@/crm/pages/campaigns/CampaignDetailContext";
import { CampaignDetailSwitch } from "@/crm/pages/campaigns/CampaignDetailSwitch";
import { CampaignsListView } from "@/crm/pages/campaigns/CampaignsListView";

/**
 * `?id=` switch, not a `[id]` dynamic segment — the packaged desktop build is
 * a static export with no server to resolve arbitrary campaign IDs at
 * runtime, same reasoning as `/broadcasts?id=` (see
 * lib/navigation/sidebar-paths.ts normalizeEntryPath and
 * docs/features/audience-and-broadcasts.md).
 */
function CampaignsRoute() {
  const searchParams = useSearchParams();
  const detail = campaignDetailFromSearch(searchParams);
  if (detail) {
    return (
      <CampaignDetailProvider key={detail.campaignId} campaignId={detail.campaignId}>
        <CampaignDetailSwitch tab={detail.tab} />
      </CampaignDetailProvider>
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
