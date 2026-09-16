"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AudienceGroupDetailProvider } from "@/studio/pages/audience/AudienceGroupDetailContext";
import { AudienceGroupDetailSwitch } from "@/studio/pages/audience/AudienceGroupDetailSwitch";
import { AudienceGroupsView } from "@/studio/pages/audience/AudienceGroupsView";
import { useAudienceRoutes } from "@/studio/pages/audience/AudienceRouteContext";

/**
 * `?id=` switch, not an `[id]` dynamic segment — same static-export
 * reasoning as `/studio/newsletters?id=` (see NewslettersView).
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
