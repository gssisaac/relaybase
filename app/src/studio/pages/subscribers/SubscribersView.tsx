"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SubscriberGroupDetailProvider } from "@/studio/pages/subscribers/SubscriberGroupDetailContext";
import { SubscriberGroupDetailSwitch } from "@/studio/pages/subscribers/SubscriberGroupDetailSwitch";
import { SubscriberGroupsView } from "@/studio/pages/subscribers/SubscriberGroupsView";
import { useSubscriberRoutes } from "@/studio/pages/subscribers/SubscriberRouteContext";

/**
 * `?id=` switch, not an `[id]` dynamic segment — same static-export
 * reasoning as `/studio/newsletters?id=` (see NewslettersView).
 */
function SubscriberRoute() {
  const searchParams = useSearchParams();
  const { subscriberDetailFromSearch } = useSubscriberRoutes();
  const detail = subscriberDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SubscriberGroupDetailProvider key={detail.groupId} groupId={detail.groupId}>
          <SubscriberGroupDetailSwitch tab={detail.tab} />
        </SubscriberGroupDetailProvider>
      </div>
    );
  }

  return <SubscriberGroupsView />;
}

export function SubscribersView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <SubscriberRoute />
    </Suspense>
  );
}
