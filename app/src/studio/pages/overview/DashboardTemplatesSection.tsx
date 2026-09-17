"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplatesCatalogDialog } from "@/studio/components/templates/TemplatesCatalogDialog";
import { TemplateThumbnailGrid } from "@/studio/components/templates/TemplateThumbnailGrid";
import { useTemplatesCatalog } from "@/studio/stores/templates-catalog";
import { useStudioPaths } from "@/studio/lib/paths";

const DASHBOARD_TEMPLATE_LIMIT = 5;

export function DashboardTemplatesSection({
  refreshKey,
}: {
  refreshKey?: string;
}) {
  const { newsletters } = useStudioPaths();
  const templatesCatalog = useTemplatesCatalog();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogInitialTemplateId, setCatalogInitialTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (refreshKey) {
      void templatesCatalog.refreshCatalog({ force: true }).catch(() => {
        toast.error("Could not load templates");
      });
      return;
    }
    templatesCatalog.ensureCatalogLoaded();
  }, [refreshKey, templatesCatalog]);

  const { templates, resolvedLayouts: layouts } = templatesCatalog;
  const loading = templatesCatalog.catalogShowPlaceholder;

  const sorted = useMemo(
    () => [...templates].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [templates],
  );

  const visible = sorted.slice(0, DASHBOARD_TEMPLATE_LIMIT);
  const remaining = Math.max(0, sorted.length - DASHBOARD_TEMPLATE_LIMIT);

  function openCatalog(initialTemplateId?: string) {
    setCatalogInitialTemplateId(initialTemplateId ?? null);
    setCatalogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Start with templates</CardTitle>
          <CardDescription>
            {loading
              ? "Loading ready-to-use templates…"
              : "Choose a pre-built template or curated layout to draft and send emails faster."}
          </CardDescription>
        </div>
        {sorted.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openCatalog()}
          >
            {remaining > 0 ? `View more (${remaining})` : "Browse templates"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-2 py-4">
            <p className="text-sm text-muted-foreground">
              No message templates yet. Create your first template or explore presets.
            </p>
            <Link
              href={`${newsletters}?new=1`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              New newsletter from template
            </Link>
          </div>
        ) : (
          <TemplateThumbnailGrid
            templates={visible}
            layouts={layouts}
            onTemplateSelect={(template) => openCatalog(template.id)}
          />
        )}
      </CardContent>

      <TemplatesCatalogDialog
        open={catalogOpen}
        onOpenChange={(next) => {
          setCatalogOpen(next);
          if (!next) setCatalogInitialTemplateId(null);
        }}
        initialTemplateId={catalogInitialTemplateId}
        title="Templates"
        description="Browse ready-to-use templates and preview before you use them."
      />
    </Card>
  );
}
