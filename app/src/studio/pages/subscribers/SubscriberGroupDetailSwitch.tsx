"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { type SubscriberDetailTab } from "@/studio/lib/paths";
import { SubscriberGroupContactsView } from "@/studio/pages/subscribers/SubscriberGroupContactsView";
import { useSubscriberGroupDetail } from "@/studio/pages/subscribers/SubscriberGroupDetailContext";
import { SubscriberGroupDetailShell } from "@/studio/pages/subscribers/SubscriberGroupDetailShell";
import { SubscriberGroupHistoryView } from "@/studio/pages/subscribers/SubscriberGroupHistoryView";
import { SubscriberGroupSettingsView } from "@/studio/pages/subscribers/SubscriberGroupSettingsView";
import { useSubscriberRoutes } from "@/studio/pages/subscribers/SubscriberRouteContext";

function SubscriberGroupNotFound() {
  const { subscribersRoot } = useSubscriberRoutes();
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
            render={<Link href={subscribersRoot} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <h1 className="truncate text-sm font-semibold">Group not found</h1>
        </div>
      </DesktopTitleBar>
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This subscriber group does not exist or was removed.
      </div>
    </div>
  );
}

export function SubscriberGroupDetailSwitch({ tab }: { tab: SubscriberDetailTab }) {
  const { detail, loading, notFound } = useSubscriberGroupDetail();

  if (loading && !detail) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !detail) return <SubscriberGroupNotFound />;

  return (
    <SubscriberGroupDetailShell section={tab}>
      {tab === "contacts" ? <SubscriberGroupContactsView /> : null}
      {tab === "history" ? <SubscriberGroupHistoryView /> : null}
      {tab === "settings" ? <SubscriberGroupSettingsView /> : null}
    </SubscriberGroupDetailShell>
  );
}
