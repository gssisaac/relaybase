import { loadBuiltinTemplates, type BuiltinTemplate } from "@services/template/load-builtin-templates";

export type { BuiltinTemplate };
export { primeWorkerBuiltinLayouts } from "@services/template/load-builtin-templates";

/** Must match `public/templates/plain-text/meta.yaml`. */
export const PLAIN_TEXT_TEMPLATE_ID = "tpl-plain-text";

export function isPlainTextTemplate(templateId: string | null | undefined): boolean {
  return templateId === PLAIN_TEXT_TEMPLATE_ID;
}

let cachedBuiltinTemplates: BuiltinTemplate[] | null = null;

/** Built-in HTML layout shells (`public/templates/*`). */
export function getBuiltinTemplates(): BuiltinTemplate[] {
  if (process.env.NODE_ENV === "production" && cachedBuiltinTemplates) {
    return cachedBuiltinTemplates;
  }
  const list = loadBuiltinTemplates();
  if (process.env.NODE_ENV === "production") {
    cachedBuiltinTemplates = list;
  }
  return list;
}
