"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { isDesktopRuntime } from "@/lib/desktop/bridge";
import {
  triggerDetailFromSearch,
  triggerDetailHref,
  resolveTriggerDetailTab,
  type TriggerDetailTab,
} from "@/scale/lib/paths";
import { TriggerDetailProvider } from "@/scale/pages/triggers/TriggerDetailContext";
import { TriggerDetailSwitch } from "@/scale/pages/triggers/TriggerDetailSwitch";
import { TriggersListView } from "@/scale/pages/triggers/TriggersListView";

function LegacyTriggerQueryRedirect({
  triggerId,
  tab,
}: {
  triggerId: string;
  tab: TriggerDetailTab | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (isDesktopRuntime()) return;
    router.replace(triggerDetailHref(triggerId, resolveTriggerDetailTab(tab)));
  }, [triggerId, router, tab]);

  return null;
}

function TriggersRoute() {
  const searchParams = useSearchParams();
  const detail = triggerDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <LegacyTriggerQueryRedirect triggerId={detail.triggerId} tab={detail.tab} />
        <TriggerDetailProvider triggerId={detail.triggerId}>
          <TriggerDetailSwitch tab={detail.tab} />
        </TriggerDetailProvider>
      </div>
    );
  }

  return <TriggersListView />;
}

export function TriggersView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TriggersRoute />
    </Suspense>
  );
}
