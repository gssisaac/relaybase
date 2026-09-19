import type { Template, TemplateCategory, TemplateTarget } from "@db/types";

const CONVERSATIONAL_IDS = new Set([
  "msgtpl_automation_inbox_support",
  "msgtpl_automation_contact_us",
  "msgtpl_automation_demo_request",
]);

export function inferCatalogTemplateTarget(id: string): TemplateTarget {
  if (id.startsWith("msgtpl_broadcast_")) return "newsletter";
  if (id.startsWith("msgtpl_automation_")) return "trigger";
  if (id === "msgtpl_preset_product_update") return "newsletter";
  if (id === "msgtpl_preset_verify_email") return "trigger";
  return "both";
}

export function inferCatalogTemplateCategory(
  id: string,
  explicit?: TemplateCategory | null,
): TemplateCategory {
  if (explicit) return explicit;
  if (id.startsWith("msgtpl_broadcast_")) return "newsletter";
  if (CONVERSATIONAL_IDS.has(id)) return "conversational";
  if (id.startsWith("msgtpl_automation_")) return "transactional";
  if (id === "msgtpl_preset_product_update") return "newsletter";
  if (id === "msgtpl_preset_verify_email") return "transactional";
  return "marketing";
}

/** Apply target + category defaults from catalog id when YAML omits them. */
export function applyCatalogTemplateMeta(row: Template): Template {
  const category = inferCatalogTemplateCategory(row.id, row.category ?? null);
  const target = row.target ?? inferCatalogTemplateTarget(row.id);
  return { ...row, target, category };
}

export function catalogTemplateMatchesTarget(
  row: Pick<Template, "id" | "target">,
  audience: "newsletter" | "trigger",
): boolean {
  const target = row.target ?? inferCatalogTemplateTarget(row.id);
  if (audience === "newsletter") return target === "newsletter" || target === "both";
  return target === "trigger" || target === "both";
}
