import { parse as parseYaml } from "yaml";

import type { Template } from "../../db/types";
import { applyCatalogTemplateMeta } from "./catalog-template-meta";

export function normalizeCatalogTemplate(row: Template): Template {
  if (row.layoutId === "tpl-header-image") {
    row.layoutId = "tpl-header";
  }
  if (row.templateVariables === undefined) row.templateVariables = {};
  if (row.previewText === undefined) row.previewText = null;
  if (row.description === undefined) row.description = null;
  row.isBuiltin = true;
  return applyCatalogTemplateMeta(row);
}

function isTemplateRecord(value: unknown): value is Template {
  if (!value || typeof value !== "object") return false;
  const row = value as Template;
  return typeof row.id === "string" && typeof row.name === "string";
}

function legacyYamlToTemplate(parsed: Record<string, unknown>): Template {
  const layoutId =
    parsed.layoutId === "tpl-header-image" ? "tpl-header" : (parsed.layoutId as string);
  const now = new Date().toISOString();
  return normalizeCatalogTemplate({
    id: parsed.id as string,
    name: parsed.name as string,
    description:
      (parsed.description as string | null | undefined) ??
      (parsed.previewText as string | null) ??
      null,
    subject: (parsed.subject as string) ?? "",
    previewText: (parsed.previewText as string | null | undefined) ?? null,
    bodyMarkdown: (parsed.bodyMarkdown as string) ?? "",
    layoutId: layoutId ?? "tpl-minimal",
    templateVariables: (parsed.templateVariables as Record<string, string>) ?? {},
    category: (parsed.category as Template["category"]) ?? undefined,
    isBuiltin: true,
    createdAt: (parsed.createdAt as string) ?? now,
    updatedAt: (parsed.updatedAt as string) ?? now,
  });
}

/** Parse a committed gallery blueprint YAML document. */
export function parseCatalogYaml(source: string): Template | null {
  try {
    const parsed = parseYaml(source);
    if (!parsed || typeof parsed !== "object") return null;
    if (isTemplateRecord(parsed)) return normalizeCatalogTemplate(parsed);
    const legacy = parsed as Record<string, unknown>;
    if (typeof legacy.id === "string" && typeof legacy.name === "string") {
      return legacyYamlToTemplate(legacy);
    }
    return null;
  } catch {
    return null;
  }
}
