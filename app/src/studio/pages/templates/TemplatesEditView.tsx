"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { messageTemplateFromSearch } from "@/studio/lib/template-paths";
import { useStudioPaths } from "@/studio/lib/paths";
import { TemplateDetailView } from "@/studio/pages/templates/TemplateDetailView";

function TemplatesEditRoute() {
  const router = useRouter();
  const { templates: templatesPath } = useStudioPaths();
  const searchParams = useSearchParams();
  const detail = messageTemplateFromSearch(searchParams);

  useEffect(() => {
    if (!detail) {
      router.replace(templatesPath);
    }
  }, [detail, router, templatesPath]);

  if (!detail) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return <TemplateDetailView key={detail.templateId} templateId={detail.templateId} />;
}

export function TemplatesEditView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <TemplatesEditRoute />
    </Suspense>
  );
}
