"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  messageTemplateFromSearch,
  messageTemplatePreviewHref,
} from "@/studio/lib/template-paths";
import { TemplateBrowseSidebarEmpty } from "@/studio/pages/templates/TemplateDetailSidebar";
import {
  TemplateDetailProvider,
  useTemplateDetail,
} from "@/studio/pages/templates/TemplateDetailContext";
import { TemplatePreviewShell } from "@/studio/pages/templates/TemplatePreviewShell";
import { TemplatePreviewView } from "@/studio/pages/templates/TemplatePreviewView";
import { TemplateSidebarNewProvider } from "@/studio/pages/templates/TemplateSidebarNewContext";
import { useTemplateSidebarList } from "@/studio/pages/templates/use-template-sidebar-list";

function pickDefaultTemplateId(rows: { id: string; updatedAt: string }[]): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return sorted[0]?.id ?? null;
}

function TemplatePreviewBody() {
  const { template, loading, notFound } = useTemplateDetail();

  if (loading && !template) {
    return (
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        Loading template…
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This template does not exist or was removed.
      </div>
    );
  }

  return <TemplatePreviewView />;
}

function TemplateBrowseWithSelection({ templateId }: { templateId: string }) {
  return (
    <TemplateDetailProvider messageTemplateId={templateId}>
      <TemplatePreviewShell>
        <TemplatePreviewBody />
      </TemplatePreviewShell>
    </TemplateDetailProvider>
  );
}

function TemplatesBrowseEmptyContent() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <TemplateBrowseSidebarEmpty />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar className="px-4 py-3">
          <h1 className="truncate text-sm font-semibold tracking-tight text-muted-foreground">
            Preview
          </h1>
        </DesktopTitleBar>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No templates yet</p>
        </div>
      </div>
    </div>
  );
}

function TemplatesBrowseInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rows, loading } = useTemplateSidebarList();

  const detail = messageTemplateFromSearch(searchParams);

  const resolvedId = useMemo(() => {
    if (detail?.templateId) return detail.templateId;
    return pickDefaultTemplateId(rows);
  }, [detail?.templateId, rows]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    const fromQuery = detail?.templateId?.trim() ?? "";
    if (fromQuery) return;
    const firstId = pickDefaultTemplateId(rows);
    if (firstId) {
      router.replace(messageTemplatePreviewHref(firstId));
    }
  }, [loading, rows, detail?.templateId, router]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Loading templates…
      </div>
    );
  }

  if (rows.length === 0 || !resolvedId) {
    return <TemplatesBrowseEmptyContent />;
  }

  return <TemplateBrowseWithSelection templateId={resolvedId} />;
}

export function TemplatesBrowseView() {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const onCreated = useCallback(
    (templateId: string) => {
      router.push(messageTemplatePreviewHref(templateId));
    },
    [router],
  );

  return (
    <TemplateSidebarNewProvider
      addOpen={addOpen}
      setAddOpen={setAddOpen}
      onCreated={onCreated}
    >
      <TemplatesBrowseInner />
    </TemplateSidebarNewProvider>
  );
}
