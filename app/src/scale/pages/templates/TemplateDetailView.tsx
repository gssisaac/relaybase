"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { ScaleDetailPageHeader } from "@/scale/components/ScaleDetailPageHeader";
import { messageTemplatePreviewHref } from "@/scale/lib/template-paths";
import { TemplateContentView } from "@/scale/pages/templates/TemplateContentView";
import { TemplateEditableTitle } from "@/scale/pages/templates/TemplateEditableTitle";
import {
  TemplateDetailProvider,
  useTemplateDetail,
} from "@/scale/pages/templates/TemplateDetailContext";
import {
  TemplateEditChromeProvider,
  useTemplateEditChrome,
} from "@/scale/pages/templates/template-edit-chrome";

function TemplateDetailBody() {
  const { messageTemplateId, template, loading, notFound } = useTemplateDetail();
  const { name, setName, subjectFallback, saveState, requestSave } = useTemplateEditChrome();
  const previewHref = messageTemplatePreviewHref(messageTemplateId);

  if (loading && !template) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ScaleDetailPageHeader backHref={previewHref} backLabel="Back to preview" title="Loading…" />
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
          backHref={previewHref}
          backLabel="Back to preview"
          title="Template not found"
        />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This template does not exist or was removed.{" "}
          <Link href={previewHref} className="text-primary underline-offset-4 hover:underline">
            Back to preview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ScaleDetailPageHeader
        backHref={previewHref}
        backLabel="Back to preview"
        titleNode={
          <div className="min-w-0 flex-1">
            <TemplateEditableTitle
              value={name}
              onChange={setName}
              subjectFallback={subjectFallback}
            />
          </div>
        }
        end={
          <Button
            size="sm"
            disabled={saveState === "saving"}
            onClick={() => void requestSave()}
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
        }
      />
      <TemplateContentView />
    </div>
  );
}

export function TemplateDetailView({ templateId }: { templateId: string }) {
  return (
    <TemplateDetailProvider messageTemplateId={templateId}>
      <TemplateEditChromeProvider>
        <TemplateDetailBody />
      </TemplateEditChromeProvider>
    </TemplateDetailProvider>
  );
}
