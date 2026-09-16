import type { Template } from "../../db/types";

export function serializeMessageTemplate(row: Template) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    layoutId: row.layoutId ?? null,
    templateVariables: row.templateVariables ?? {},
    category: row.category ?? null,
    isPreset: row.isPreset ?? false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
