"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CampaignsListView } from "./CampaignsListView";
import { CampaignComposeView } from "./CampaignComposeView";

/**
 * `?id=` switch, not a `[id]` dynamic segment — the packaged desktop build is
 * a static export with no server to resolve arbitrary campaign IDs at
 * runtime, same reasoning as `/broadcasts?id=` (see
 * lib/navigation/sidebar-paths.ts normalizeEntryPath and
 * docs/features/audience-and-broadcasts.md).
 */
function CampaignsRoute() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  if (id) return <CampaignComposeView campaignId={id} />;
  return <CampaignsListView />;
}

export function CampaignsView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <CampaignsRoute />
    </Suspense>
  );
}
