"use client";

import { Suspense } from "react";

import { TemplatesGridView } from "@/studio/pages/templates/TemplatesGridView";

export function TemplatesView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TemplatesGridView />
    </Suspense>
  );
}
