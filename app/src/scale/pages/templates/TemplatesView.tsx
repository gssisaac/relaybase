"use client";

import { Suspense } from "react";

import { TemplatesBrowseView } from "@/scale/pages/templates/TemplatesBrowseView";

export function TemplatesView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TemplatesBrowseView />
    </Suspense>
  );
}
