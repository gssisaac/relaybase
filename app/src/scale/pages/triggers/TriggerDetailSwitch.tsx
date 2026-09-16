"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  defaultTriggerDetailTab,
  normalizeTriggerDetailTab,
} from "@/scale/lib/triggers/trigger-detail-nav";
import { triggerDetailHref, type TriggerDetailTab } from "@/scale/lib/paths";
import { TriggerDetailShell } from "@/scale/pages/triggers/TriggerDetailShell";
import { TriggerConfigView } from "@/scale/pages/triggers/TriggerConfigView";
import { TriggerStatsView } from "@/scale/pages/triggers/TriggerStatsView";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";

export function TriggerDefaultTabRedirect() {
  const router = useRouter();
  const { triggerId, trigger, loading, notFound } = useTriggerDetail();

  useEffect(() => {
    if (!trigger) return;
    router.replace(
      triggerDetailHref(triggerId, defaultTriggerDetailTab(trigger.status), trigger.status),
    );
  }, [trigger, triggerId, router]);

  if (notFound && !loading) {
    return (
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This trigger does not exist or was removed.{" "}
        <Link href="/scale/triggers" className="text-primary underline-offset-4 hover:underline">
          Back to triggers
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

export function TriggerDetailSwitch({ tab }: { tab: TriggerDetailTab | null }) {
  const router = useRouter();
  const { triggerId, trigger, loading, notFound } = useTriggerDetail();

  const resolvedTab = trigger
    ? normalizeTriggerDetailTab(
        tab ?? defaultTriggerDetailTab(trigger.status),
        trigger.status,
      )
    : normalizeTriggerDetailTab(tab ?? "config", "draft");

  useEffect(() => {
    if (!trigger || tab === null) return;
    if (resolvedTab !== tab) {
      router.replace(triggerDetailHref(triggerId, resolvedTab, trigger.status));
    }
  }, [trigger, triggerId, resolvedTab, router, tab]);

  const fill = resolvedTab === "config";

  return (
    <TriggerDetailShell section={resolvedTab} fill={fill}>
      {notFound && !loading ? (
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This trigger does not exist or was removed.{" "}
          <Link href="/scale/triggers" className="text-primary underline-offset-4 hover:underline">
            Back to triggers
          </Link>
        </div>
      ) : loading && !trigger ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <>
          {resolvedTab === "config" ? <TriggerConfigView /> : null}
          {resolvedTab === "stats" ? <TriggerStatsView /> : null}
        </>
      )}
    </TriggerDetailShell>
  );
}
