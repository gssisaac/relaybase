import type { Template } from "../../db/types";

/** Catalog blueprint (read-only gallery). */
export function serializeTemplate(row: Template) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    layoutId: row.layoutId,
    templateVariables: row.templateVariables ?? {},
    category: row.category ?? null,
    isBuiltin: true as const,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** @deprecated Use serializeTemplate — kept for transitional imports. */
export function serializeMessageTemplate(row: Template) {
  return {
    ...serializeTemplate(row),
    isPreset: true,
  };
}
