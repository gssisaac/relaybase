import type { Template } from "@db/types";
import { applyCatalogTemplateMeta } from "@services/template/catalog-template-meta";

/** Catalog blueprint (read-only gallery). */
export function serializeTemplate(row: Template) {
  const meta = applyCatalogTemplateMeta(row);
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description ?? null,
    subject: meta.subject,
    previewText: meta.previewText ?? null,
    bodyMarkdown: meta.bodyMarkdown,
    layoutId: meta.layoutId,
    templateVariables: meta.templateVariables ?? {},
    target: meta.target!,
    category: meta.category ?? null,
    isBuiltin: true as const,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

/** @deprecated Use serializeTemplate — kept for transitional imports. */
export function serializeMessageTemplate(row: Template) {
  return {
    ...serializeTemplate(row),
    isPreset: true,
  };
}
