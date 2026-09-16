"use client";

import { LayoutTemplate, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { CatalogTemplatePreviewDialog } from "@/studio/components/templates/CatalogTemplatePreviewDialog";
import { TemplateThumbnailGrid } from "@/studio/components/templates/TemplateThumbnailGrid";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import { useStudioPaths } from "@/studio/lib/paths";
import { messagesRootHref } from "@/studio/lib/message-paths";
import { templatesRootHref } from "@/studio/lib/template-paths";
import { studioApi, type StudioTemplate, type StudioLayout } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

export function TemplatesGridView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { layouts: layoutsPath } = useStudioPaths();
  const [templates, setTemplates] = useState<StudioTemplate[]>([]);
  const [layouts, setLayouts] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<StudioTemplate | null>(null);
  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [templateRes, layoutRes] = await Promise.all([
        studioApi.listTemplates(),
        studioApi.listLayouts(),
      ]);
      setTemplates(templateRes.templates);
      setLayouts(layoutRes.layouts);
    } catch {
      toast.error("Could not load templates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const legacyId = searchParams.get("id")?.trim();
    if (!legacyId || templates.length === 0) return;
    const match = templates.find((row) => row.id === legacyId);
    if (match) setPreviewTemplate(match);
    router.replace(templatesRootHref());
  }, [searchParams, templates, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...templates].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    if (!q) return sorted;
    return sorted.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q) ||
        (row.category?.toLowerCase().includes(q) ?? false) ||
        row.id.toLowerCase().includes(q),
    );
  }, [templates, search]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={layoutsPath} />}>
              <LayoutTemplate className="size-4" />
              Layouts
            </Button>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={messagesRootHref()} />}>
              <Mail className="size-4" />
              Messages
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={() => void load(true)}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden />
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Read-only catalog — preview a blueprint, then use it to create an editable message.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search templates…"
          />

          {loading && templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {search.trim()
                  ? "No templates match your search."
                  : "No catalog templates yet."}
              </p>
            </div>
          ) : (
            <TemplateThumbnailGrid
              templates={filtered}
              layouts={layouts}
              onTemplateSelect={setPreviewTemplate}
            />
          )}
        </div>
      </div>

      <CatalogTemplatePreviewDialog
        template={previewTemplate}
        layouts={layouts}
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
      />
    </div>
  );
}
