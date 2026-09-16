"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { TemplatesBrowseView } from "@/studio/pages/templates/TemplatesBrowseView";
import { TemplatesGridView } from "@/studio/pages/templates/TemplatesGridView";
import { messageTemplateFromSearch } from "@/studio/lib/template-paths";

function TemplatesViewBody() {
  const searchParams = useSearchParams();
  const detail = messageTemplateFromSearch(searchParams);

  if (detail?.templateId) {
    return <TemplatesBrowseView />;
  }

  return <TemplatesGridView />;
}

export function TemplatesView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TemplatesViewBody />
    </Suspense>
  );
}
