"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { BroadcastAudienceView } from "@/console/pages/broadcasts/BroadcastAudienceView";
import { BroadcastContentView } from "@/console/pages/broadcasts/BroadcastContentView";
import { useBroadcastDetail } from "@/console/pages/broadcasts/BroadcastDetailContext";
import { BroadcastDetailShell } from "@/console/pages/broadcasts/BroadcastDetailShell";
import { BroadcastDraftView } from "@/console/pages/broadcasts/BroadcastDraftView";
import { BroadcastOverviewView } from "@/console/pages/broadcasts/BroadcastOverviewView";
import { BroadcastProgressView } from "@/console/pages/broadcasts/BroadcastProgressView";
import type { BroadcastDetailTab } from "@/console/lib/paths";
import { useDashboardPaths } from "@/console/lib/paths";

function BroadcastNotFound() {
  const { broadcasts } = useDashboardPaths();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            nativeButton={false}
            render={<Link href={broadcasts} />}
          >
            <ArrowLeft className="size-4" />
            Broadcasts
          </Button>
          <h1 className="truncate text-sm font-semibold">Broadcast not found</h1>
        </div>
      </DesktopTitleBar>
      <div className="mx-auto w-full max-w-[1200px] p-4 text-sm text-muted-foreground">
        This broadcast does not exist or was removed.
      </div>
    </div>
  );
}

export function BroadcastDetailSwitch({ tab }: { tab: BroadcastDetailTab }) {
  const { detail, loading, notFound } = useBroadcastDetail();
  const status = detail?.broadcast.status;

  if (loading && !detail) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (notFound || !detail) return <BroadcastNotFound />;

  if (status === "draft" && tab === "overview") {
    return <BroadcastDraftView />;
  }

  return (
    <BroadcastDetailShell section={tab}>
      {tab === "overview" ? <BroadcastOverviewView /> : null}
      {tab === "audience" ? <BroadcastAudienceView /> : null}
      {tab === "content" ? <BroadcastContentView /> : null}
      {tab === "progress" ? <BroadcastProgressView /> : null}
    </BroadcastDetailShell>
  );
}
