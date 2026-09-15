"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { automationDetailFromSearch } from "@/scale/lib/paths";
import { AutomationDetailProvider } from "@/scale/pages/automations/AutomationDetailContext";
import { AutomationDetailSwitch } from "@/scale/pages/automations/AutomationDetailSwitch";
import { AutomationsListView } from "@/scale/pages/automations/AutomationsListView";

function AutomationsRoute() {
  const searchParams = useSearchParams();
  const detail = automationDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AutomationDetailProvider key={detail.automationId} automationId={detail.automationId}>
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
