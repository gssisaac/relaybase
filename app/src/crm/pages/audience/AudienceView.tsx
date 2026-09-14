"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AudienceGroupDetailProvider } from "@/crm/pages/audience/AudienceGroupDetailContext";
import { AudienceGroupDetailSwitch } from "@/crm/pages/audience/AudienceGroupDetailSwitch";
import { AudienceGroupsView } from "@/crm/pages/audience/AudienceGroupsView";
import { useAudienceRoutes } from "@/crm/pages/audience/AudienceRouteContext";

/**
 * `?id=` switch, not an `[id]` dynamic segment — same static-export
 * reasoning as `/crm/campaigns?id=` (see CampaignsView).
 */
function AudienceRoute() {
  const searchParams = useSearchParams();
  const { audienceDetailFromSearch } = useAudienceRoutes();
  const detail = audienceDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AudienceGroupDetailProvider key={detail.groupId} groupId={detail.groupId}>
          <AudienceGroupDetailSwitch tab={detail.tab} />
        </AudienceGroupDetailProvider>
      </div>
    );
  }

  return <AudienceGroupsView />;
}

export function AudienceView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <AudienceRoute />
    </Suspense>
  );
}
