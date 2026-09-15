"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { messageTemplateFromSearch } from "@/scale/lib/template-paths";
import { TemplateDetailView } from "@/scale/pages/templates/TemplateDetailView";
import { TemplatesListView } from "@/scale/pages/templates/TemplatesListView";

function TemplatesRoute() {
  const searchParams = useSearchParams();
  const detail = messageTemplateFromSearch(searchParams);
  if (detail) {
    return <TemplateDetailView key={detail.templateId} templateId={detail.templateId} />;
  }
  return <TemplatesListView />;
}

export function TemplatesView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TemplatesRoute />
    </Suspense>
  );
}
