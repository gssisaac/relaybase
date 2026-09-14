"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { useCrmPaths, type CampaignDetailTab } from "@/crm/lib/paths";
import { CampaignBroadcastsView } from "@/crm/pages/campaigns/CampaignBroadcastsView";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { CampaignDetailShell } from "@/crm/pages/campaigns/CampaignDetailShell";
import { CampaignSettingsView } from "@/crm/pages/campaigns/CampaignSettingsView";
import { CampaignSubscribersView } from "@/crm/pages/campaigns/CampaignSubscribersView";

function CampaignNotFound() {
  const { campaigns } = useCrmPaths();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            nativeButton={false}
            render={<Link href={campaigns} />}
          >
            <ArrowLeft className="size-4" />
            Campaigns
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

export function CampaignDetailSwitch({ tab }: { tab: CampaignDetailTab }) {
  const { campaign, loading, notFound } = useCampaignDetail();

  if (loading && !campaign) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !campaign) return <CampaignNotFound />;

  return (
    <CampaignDetailShell section={tab}>
      {tab === "subscribers" ? <CampaignSubscribersView /> : null}
      {tab === "broadcasts" ? <CampaignBroadcastsView /> : null}
      {tab === "settings" ? <CampaignSettingsView /> : null}
    </CampaignDetailShell>
  );
}
