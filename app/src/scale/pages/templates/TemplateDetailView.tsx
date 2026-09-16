"use client";

import Link from "next/link";

import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { ScaleDetailPageHeader } from "@/scale/components/ScaleDetailPageHeader";
import { useScalePaths } from "@/scale/lib/paths";
import { TemplateContentView } from "@/scale/pages/templates/TemplateContentView";
import {
  TemplateDetailProvider,
  useTemplateDetail,
} from "@/scale/pages/templates/TemplateDetailContext";
import { TemplateUseActions } from "@/scale/pages/templates/TemplateUseActions";

function TemplateDetailBody() {
  const { templates: templatesPath } = useScalePaths();
  const { template, loading, notFound } = useTemplateDetail();

  if (loading && !template) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ScaleDetailPageHeader backHref={templatesPath} backLabel="Back to templates" title="Loading…" />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          Loading template…
        </div>
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ScaleDetailPageHeader
          backHref={templatesPath}
          backLabel="Back to templates"
          title="Template not found"
        />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This template does not exist or was removed.{" "}
          <Link href={templatesPath} className="text-primary underline-offset-4 hover:underline">
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  const title = template.name.trim() || template.subject.trim() || "Untitled template";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ScaleDetailPageHeader
        backHref={templatesPath}
        backLabel="Back to templates"
        title={title}
        end={<TemplateUseActions />}
      />
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
