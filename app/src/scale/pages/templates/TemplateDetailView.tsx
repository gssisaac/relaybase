"use client";

import Link from "next/link";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { buttonVariants } from "@/components/ui/button";
import { useScalePaths } from "@/scale/lib/paths";
import { TemplateContentView } from "@/scale/pages/templates/TemplateContentView";
import {
  TemplateDetailProvider,
  useTemplateDetail,
} from "@/scale/pages/templates/TemplateDetailContext";
import { cn } from "@/lib/utils";

function TemplateDetailBody() {
  const { templates: templatesPath } = useScalePaths();
  const { template, loading, notFound } = useTemplateDetail();

  if (loading && !template) {
    return <p className="p-4 text-sm text-muted-foreground">Loading template…</p>;
  }

  if (notFound || !template) {
    return (
      <div className="p-4 text-sm">
        Template not found.{" "}
        <Link href={templatesPath} className="text-primary underline-offset-4 hover:underline">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-2">
        <Link href={templatesPath} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Templates
        </Link>
        <span className="truncate text-sm font-medium text-foreground">{template.name}</span>
      </DesktopTitleBar>
      <TemplateContentView />
    </div>
  );
}

export function TemplateDetailView({ templateId }: { templateId: string }) {
  return (
    <TemplateDetailProvider messageTemplateId={templateId}>
      <TemplateDetailBody />
    </TemplateDetailProvider>
  );
}
