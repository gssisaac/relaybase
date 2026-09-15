"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  defaultAutomationDetailTab,
  normalizeAutomationDetailTab,
} from "@/scale/lib/automation-detail-nav";
import { automationDetailHref, type AutomationDetailTab } from "@/scale/lib/paths";
import { AutomationDetailShell } from "@/scale/pages/automations/AutomationDetailShell";
import { AutomationPreviewView } from "@/scale/pages/automations/AutomationPreviewView";
import { AutomationSettingsView } from "@/scale/pages/automations/AutomationSettingsView";
import { AutomationStatsView } from "@/scale/pages/automations/AutomationStatsView";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";

export function AutomationDefaultTabRedirect() {
  const router = useRouter();
  const { automationId, automation, loading, notFound } = useAutomationDetail();

  useEffect(() => {
    if (!automation) return;
    router.replace(
      automationDetailHref(automationId, defaultAutomationDetailTab(automation.status), automation.status),
    );
  }, [automation, automationId, router]);

  if (notFound && !loading) {
    return (
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This automation does not exist or was removed.{" "}
        <Link href="/scale/automations" className="text-primary underline-offset-4 hover:underline">
          Back to automations
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
      Loading…
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
    : normalizeAutomationDetailTab(tab ?? "preview", "draft");

  useEffect(() => {
    if (!automation || tab === null) return;
    if (resolvedTab !== tab) {
      router.replace(automationDetailHref(automationId, resolvedTab, automation.status));
    }
  }, [automation, automationId, resolvedTab, router, tab]);

  const fill = resolvedTab === "preview";

  return (
    <AutomationDetailShell section={resolvedTab} fill={fill}>
      {notFound && !loading ? (
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This automation does not exist or was removed.{" "}
          <Link href="/scale/automations" className="text-primary underline-offset-4 hover:underline">
            Back to automations
          </Link>
        </div>
      ) : loading && !automation ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <>
          {resolvedTab === "preview" ? <AutomationPreviewView /> : null}
          {resolvedTab === "stats" ? <AutomationStatsView /> : null}
          {resolvedTab === "settings" ? <AutomationSettingsView /> : null}
        </>
      )}
    </AutomationDetailShell>
  );
}
