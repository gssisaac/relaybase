"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  defaultAutomationDetailTab,
  normalizeAutomationDetailTab,
} from "@/scale/lib/automation-detail-nav";
import { automationDetailHref, useScalePaths, type AutomationDetailTab } from "@/scale/lib/paths";
import { AutomationContentView } from "@/scale/pages/automations/AutomationContentView";
import { AutomationDetailShell } from "@/scale/pages/automations/AutomationDetailShell";
import { AutomationSettingsView } from "@/scale/pages/automations/AutomationSettingsView";
import { AutomationStatsView } from "@/scale/pages/automations/AutomationStatsView";
import { AutomationTriggerView } from "@/scale/pages/automations/AutomationTriggerView";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";

function AutomationNotFound() {
  const { automations } = useScalePaths();
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
            render={<Link href={automations} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <h1 className="truncate text-sm font-semibold">Automation not found</h1>
        </div>
      </DesktopTitleBar>
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This automation does not exist or was removed.
      </div>
    </div>
  );
}

export function AutomationDetailSwitch({ tab }: { tab: AutomationDetailTab | null }) {
  const router = useRouter();
  const { automationId, automation, loading, notFound } = useAutomationDetail();

  const resolvedTab = automation
    ? normalizeAutomationDetailTab(
        tab ?? defaultAutomationDetailTab(automation.status),
        automation.status,
      )
    : tab ?? "content";

  useEffect(() => {
    if (!automation || tab === null) return;
    if (resolvedTab !== tab) {
      router.replace(automationDetailHref(automationId, resolvedTab, automation.status));
    }
  }, [automation, automationId, resolvedTab, router, tab]);

  if (loading && !automation) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !automation) return <AutomationNotFound />;

  return (
    <AutomationDetailShell section={resolvedTab} fill={resolvedTab === "content"}>
      {resolvedTab === "content" ? <AutomationContentView /> : null}
      {resolvedTab === "trigger" ? <AutomationTriggerView /> : null}
      {resolvedTab === "stats" ? <AutomationStatsView /> : null}
      {resolvedTab === "settings" ? <AutomationSettingsView /> : null}
    </AutomationDetailShell>
  );
}
