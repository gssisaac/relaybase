"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { isDesktopRuntime } from "@/lib/desktop/bridge";
import {
  automationDetailFromSearch,
  automationDetailHref,
  resolveAutomationDetailTab,
  type AutomationDetailTab,
} from "@/scale/lib/paths";
import { AutomationDetailProvider } from "@/scale/pages/automations/AutomationDetailContext";
import { AutomationDetailSwitch } from "@/scale/pages/automations/AutomationDetailSwitch";
import { AutomationsListView } from "@/scale/pages/automations/AutomationsListView";

function LegacyAutomationQueryRedirect({
  automationId,
  tab,
}: {
  automationId: string;
  tab: AutomationDetailTab | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (isDesktopRuntime()) return;
    router.replace(automationDetailHref(automationId, resolveAutomationDetailTab(tab)));
  }, [automationId, router, tab]);

  return null;
}

function AutomationsRoute() {
  const searchParams = useSearchParams();
  const detail = automationDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <LegacyAutomationQueryRedirect automationId={detail.automationId} tab={detail.tab} />
        <AutomationDetailProvider automationId={detail.automationId}>
          <AutomationDetailSwitch tab={detail.tab} />
        </AutomationDetailProvider>
      </div>
    );
  }

  return <AutomationsListView />;
}

export function AutomationsView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <AutomationsRoute />
    </Suspense>
  );
}
