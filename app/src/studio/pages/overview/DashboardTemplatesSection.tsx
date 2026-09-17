"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CatalogTemplatePreviewDialog } from "@/studio/components/templates/CatalogTemplatePreviewDialog";
import { TemplateThumbnailGrid } from "@/studio/components/templates/TemplateThumbnailGrid";
import { templatesRootHref } from "@/studio/lib/templates/template-paths";
import { studioApi, type StudioLayout, type StudioTemplate } from "@/studio/api";

const DASHBOARD_TEMPLATE_LIMIT = 5;

export function DashboardTemplatesSection({
  refreshKey,
}: {
  refreshKey?: string;
}) {
  const templatesHref = templatesRootHref();
  const [templates, setTemplates] = useState<StudioTemplate[]>([]);
  const [layouts, setLayouts] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<StudioTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([studioApi.listTemplates(), studioApi.listLayouts()])
      .then(([templateRes, layoutRes]) => {
        if (cancelled) return;
        setTemplates(templateRes.templates);
        setLayouts(layoutRes.layouts);
      })
      .catch(() => {
        if (!cancelled) {
          setTemplates([]);
          setLayouts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const sorted = useMemo(
    () => [...templates].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [templates],
  );

  const visible = sorted.slice(0, DASHBOARD_TEMPLATE_LIMIT);
  const remaining = Math.max(0, sorted.length - DASHBOARD_TEMPLATE_LIMIT);

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
        {remaining > 0 ? (
          <Link href={templatesHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View more ({remaining})
          </Link>
        ) : (
          <Link href={templatesHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all templates
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-2 py-4">
            <p className="text-sm text-muted-foreground">
              No message templates yet. Create your first template or explore presets.
            </p>
            <Link href={templatesHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Browse templates
            </Link>
          </div>
        ) : (
          <TemplateThumbnailGrid
            templates={visible}
            layouts={layouts}
            onTemplateSelect={setPreviewTemplate}
          />
        )}
      </CardContent>

      <CatalogTemplatePreviewDialog
        template={previewTemplate}
        layouts={layouts}
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
      />
    </Card>
  );
}
