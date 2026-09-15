"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  defaultCampaignDetailTab,
  normalizeCampaignDetailTab,
} from "@/scale/lib/campaigns/campaign-detail-nav";
import { campaignDetailHref, useScalePaths, type CampaignDetailTab } from "@/scale/lib/paths";
import { CampaignSubscribersView } from "@/scale/pages/campaigns/CampaignSubscribersView";
import { CampaignContentView } from "@/scale/pages/campaigns/CampaignContentView";
import { CampaignDetailShell } from "@/scale/pages/campaigns/CampaignDetailShell";
import { CampaignPublishView } from "@/scale/pages/campaigns/CampaignPublishView";
import { CampaignSettingsView } from "@/scale/pages/campaigns/CampaignSettingsView";
import { CampaignStatsView } from "@/scale/pages/campaigns/CampaignStatsView";
import { useCampaignDetail } from "@/scale/pages/campaigns/CampaignDetailContext";

function CampaignNotFound() {
  const { campaigns } = useScalePaths();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2"
            nativeButton={false}
            aria-label="Back"
            render={<Link href={campaigns} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <h1 className="truncate text-sm font-semibold">Campaign not found</h1>
        </div>
      </DesktopTitleBar>
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This campaign does not exist or was removed.
      </div>
    </div>
  );
}

export function CampaignDetailSwitch({ tab }: { tab: CampaignDetailTab | null }) {
  const router = useRouter();
  const { campaignId, campaign, loading, notFound } = useCampaignDetail();

  const resolvedTab = campaign
    ? normalizeCampaignDetailTab(
        tab ?? defaultCampaignDetailTab(campaign.status),
        campaign.status,
      )
    : tab ?? "content";

  useEffect(() => {
    if (!campaign || tab === null) return;
    if (resolvedTab !== tab) {
      router.replace(campaignDetailHref(campaignId, resolvedTab, campaign.status));
    }
  }, [campaign, campaignId, resolvedTab, router, tab]);

  if (loading && !campaign) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !campaign) return <CampaignNotFound />;

  return (
    <CampaignDetailShell section={resolvedTab} fill={resolvedTab === "content"}>
      {resolvedTab === "content" ? <CampaignContentView /> : null}
      {resolvedTab === "publish" ? <CampaignPublishView /> : null}
      {resolvedTab === "recipients" ? <CampaignSubscribersView /> : null}
      {resolvedTab === "stats" ? <CampaignStatsView /> : null}
      {resolvedTab === "settings" ? <CampaignSettingsView /> : null}
    </CampaignDetailShell>
  );
}
