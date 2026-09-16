"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { layoutFromSearch } from "@/studio/lib/layout-paths";
import { LayoutDetailView } from "@/studio/pages/layouts/LayoutDetailView";
import { LayoutsListView } from "@/studio/pages/layouts/LayoutsListView";

function LayoutsRoute() {
  const searchParams = useSearchParams();
  const detail = layoutFromSearch(searchParams);
  if (detail) {
    return <LayoutDetailView key={detail.layoutId} layoutId={detail.layoutId} />;
  }
  return <LayoutsListView />;
}

export function LayoutsView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <LayoutsRoute />
    </Suspense>
  );
}
