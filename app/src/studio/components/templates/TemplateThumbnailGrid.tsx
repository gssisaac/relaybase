"use client";

import { TemplateThumbnailPreview } from "@/studio/components/templates/TemplateThumbnailPreview";
import { studioGalleryGridClassName } from "@/studio/lib/gallery/studio-gallery-grid";
import type { StudioLayout, StudioTemplate } from "@/studio/api";
import { cn } from "@/lib/utils";

export function resolveTemplateLayout(
  template: StudioTemplate,
  layouts: StudioLayout[],
): StudioLayout | null {
  return layouts.find((row) => row.id === template.layoutId) ?? null;
}

function templateCardSubtitle(template: StudioTemplate): string {
  if (template.category) {
    return template.category.replaceAll("_", " ");
  }
  return "Catalog";
}

export function TemplateThumbnailGrid({
  templates,
  layouts,
  className,
  onTemplateSelect,
}: {
  templates: StudioTemplate[];
  layouts: StudioLayout[];
  className?: string;
  onTemplateSelect: (template: StudioTemplate) => void;
}) {
  return (
    <ul className={cn(studioGalleryGridClassName, className)}>
      {templates.map((template) => {
        const layout = resolveTemplateLayout(template, layouts);
        return (
          <li key={template.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onTemplateSelect(template)}
              className="group flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/40 hover:shadow-sm"
            >
              <TemplateThumbnailPreview
                templateId={template.id}
                template={template}
                layout={layout}
                isPreset
              />
              <div className="space-y-0.5 border-t px-3 py-2.5">
                <p className="truncate text-sm font-medium">{template.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {templateCardSubtitle(template)}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
