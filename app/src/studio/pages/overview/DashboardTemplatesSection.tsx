"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplatesCatalogDialog } from "@/studio/components/templates/TemplatesCatalogDialog";
import { TemplateThumbnailGrid } from "@/studio/components/templates/TemplateThumbnailGrid";
import type { StudioLayout, StudioTemplate } from "@/studio/api";
import { useTemplatesCatalog } from "@/studio/stores/templates-catalog";
import { useStudioPaths } from "@/studio/lib/paths";

export function DashboardTemplatesSection({
  templates,
  layouts,
  loading,
}: {
  templates: StudioTemplate[];
  layouts: StudioLayout[];
  loading?: boolean;
}) {
  const { newsletters } = useStudioPaths();
  const templatesCatalog = useTemplatesCatalog();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogInitialTemplateId, setCatalogInitialTemplateId] = useState<string | null>(null);

  const remaining = Math.max(0, templatesCatalog.templates.length - templates.length);

  function openCatalog(initialTemplateId?: string) {
    templatesCatalog.ensureCatalogLoaded();
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
        {templates.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => openCatalog()}>
            {remaining > 0 ? `View more (${remaining})` : "Browse templates"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : templates.length === 0 ? (
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
            templates={templates}
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
