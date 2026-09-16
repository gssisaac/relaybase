"use client";

import Link from "next/link";

import { TemplateThumbnailPreview } from "@/studio/components/templates/TemplateThumbnailPreview";
import { messageTemplatePreviewHref } from "@/studio/lib/template-paths";
import type { MessageTemplate, StudioLayout } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

export function resolveMessageTemplateLayout(
  template: MessageTemplate,
  layouts: StudioLayout[],
): StudioLayout | null {
  const layoutId = template.layoutId ?? layouts[0]?.id;
  if (!layoutId) return null;
  return layouts.find((row) => row.id === layoutId) ?? null;
}

function templateCardSubtitle(template: MessageTemplate): string {
  if (template.isPreset) {
    return `Starter · ${template.category?.replaceAll("_", " ") ?? "Template"}`;
  }
  if (template.category) {
    return template.category.replaceAll("_", " ");
  }
  return "Custom template";
}

export function MessageTemplateThumbnailGrid({
  templates,
  layouts,
  className,
}: {
  templates: MessageTemplate[];
  layouts: StudioLayout[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
        className,
      )}
    >
      {templates.map((template) => {
        const layout = resolveMessageTemplateLayout(template, layouts);
        return (
          <li key={template.id}>
            <Link
              href={messageTemplatePreviewHref(template.id)}
              className={cn(
                "flex h-full flex-col rounded-lg border border-border bg-card p-3 text-left",
                "transition-colors hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <TemplateThumbnailPreview
                templateId={template.id}
                template={template}
                layout={layout}
                isPreset={template.isPreset}
                className="mb-2.5"
              />
              <span className="line-clamp-2 text-sm font-medium leading-snug">{template.name}</span>
              <span className="mt-1 block text-[10px] capitalize text-muted-foreground">
                {templateCardSubtitle(template)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
