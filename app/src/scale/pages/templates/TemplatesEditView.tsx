"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { messageTemplateFromSearch } from "@/scale/lib/template-paths";
import { useScalePaths } from "@/scale/lib/paths";
import { TemplateDetailView } from "@/scale/pages/templates/TemplateDetailView";

function TemplatesEditRoute() {
  const router = useRouter();
  const { templates: templatesPath } = useScalePaths();
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
