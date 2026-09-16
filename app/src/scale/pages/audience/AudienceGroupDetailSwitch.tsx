"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { type AudienceDetailTab } from "@/scale/lib/paths";
import { AudienceGroupContactsView } from "@/scale/pages/audience/AudienceGroupContactsView";
import { useAudienceGroupDetail } from "@/scale/pages/audience/AudienceGroupDetailContext";
import { AudienceGroupDetailShell } from "@/scale/pages/audience/AudienceGroupDetailShell";
import { AudienceGroupHistoryView } from "@/scale/pages/audience/AudienceGroupHistoryView";
import { AudienceGroupSettingsView } from "@/scale/pages/audience/AudienceGroupSettingsView";
import { useAudienceRoutes } from "@/scale/pages/audience/AudienceRouteContext";

function AudienceGroupNotFound() {
  const { audienceRoot } = useAudienceRoutes();
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
            render={<Link href={audienceRoot} />}
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

export function AudienceGroupDetailSwitch({ tab }: { tab: AudienceDetailTab }) {
  const { detail, loading, notFound } = useAudienceGroupDetail();

  if (loading && !detail) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !detail) return <AudienceGroupNotFound />;

  return (
    <AudienceGroupDetailShell section={tab}>
      {tab === "contacts" ? <AudienceGroupContactsView /> : null}
      {tab === "history" ? <AudienceGroupHistoryView /> : null}
      {tab === "settings" ? <AudienceGroupSettingsView /> : null}
    </AudienceGroupDetailShell>
  );
}
