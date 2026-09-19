import type { StudioTemplate, TemplateCategory, TriggerPurpose } from "@/studio/api";

export type TemplateTarget = "newsletter" | "trigger" | "both";

export type CatalogTemplateAudience = "all" | "newsletter" | "trigger";

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

export function resolveCatalogTemplateTarget(template: Pick<StudioTemplate, "id" | "target">): TemplateTarget {
  return template.target ?? inferCatalogTemplateTarget(template.id);
}

export function catalogTemplateMatchesAudience(
  template: Pick<StudioTemplate, "id" | "target">,
  audience: Exclude<CatalogTemplateAudience, "all">,
): boolean {
  const target = resolveCatalogTemplateTarget(template);
  if (audience === "newsletter") return target === "newsletter" || target === "both";
  return target === "trigger" || target === "both";
}

export function filterCatalogTemplatesByAudience(
  templates: StudioTemplate[],
  audience: CatalogTemplateAudience,
): StudioTemplate[] {
  if (audience === "all") return templates;
  return templates.filter((row) => catalogTemplateMatchesAudience(row, audience));
}

export function catalogTemplateAudienceLabel(template: Pick<StudioTemplate, "id" | "target">): string {
  const target = resolveCatalogTemplateTarget(template);
  if (target === "newsletter") return "Newsletter";
  if (target === "trigger") return "Trigger";
  return "Newsletter · Trigger";
}

export function catalogTemplateCardSubtitle(template: StudioTemplate): string {
  const audience = catalogTemplateAudienceLabel(template);
  if (template.category) {
    const category = template.category.replaceAll("_", " ");
    return `${audience} · ${category}`;
  }
  return audience;
}

export function triggerPurposeFromCatalogTemplate(template: StudioTemplate): TriggerPurpose {
  if (template.category === "conversational" || CONVERSATIONAL_IDS.has(template.id)) {
    return "conversational";
  }
  if (template.category === "marketing") return "marketing";
  return "transactional";
}

export function isTriggerPrimaryTemplate(template: Pick<StudioTemplate, "id" | "target">): boolean {
  const target = resolveCatalogTemplateTarget(template);
  return target === "trigger";
}

export function isNewsletterPrimaryTemplate(template: Pick<StudioTemplate, "id" | "target">): boolean {
  const target = resolveCatalogTemplateTarget(template);
  return target === "newsletter";
}
