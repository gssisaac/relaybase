/**
 * Client mirror of hq/crm `variable-schema.ts` (preview + compose UI).
 */

export type TemplateVariableType = "text" | "image";

export type TemplateVariableDefaultFrom = "compliance.organizationName";

export type TemplateVariableField = {
  key: string;
  type: TemplateVariableType;
  label: string;
  description?: string;
  required?: boolean;
  defaultFrom?: TemplateVariableDefaultFrom;
};

export type TemplateVariablesSchema = {
  fields: TemplateVariableField[];
};

export function templateVariableToken(key: string): string {
  return `{{vars.${key}}}`;
}

const HEADER_LOGO_MAX_WIDTH_PX = 120;
const HEADER_LOGO_HEIGHT_PX = 40;

const DEFAULT_VARIABLE_IMAGE_STYLE = "display:block;max-width:160px;height:auto;border:0;";

function headerLogoImageHtml(src: string): string {
  const w = HEADER_LOGO_MAX_WIDTH_PX;
  const h = HEADER_LOGO_HEIGHT_PX;
  return `<img src="${src}" alt="" width="${w}" height="${h}" style="display:block;border:0;outline:none;text-decoration:none;width:auto;height:${h}px;max-height:${h}px;max-width:${w}px;" />`;
}

function defaultVariableImageHtml(src: string): string {
  return `<img src="${src}" alt="" style="${DEFAULT_VARIABLE_IMAGE_STYLE}" />`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function applyTemplateVariablesToHtml(
  html: string,
  schema: TemplateVariablesSchema | null | undefined,
  values: Record<string, string> | null | undefined,
): string {
  if (!schema?.fields.length) return html;
  const map = values ?? {};
  let out = html;

  for (const field of schema.fields) {
    const raw = map[field.key]?.trim() ?? "";
    let replacement = "";
    if (field.type === "text") {
      replacement = escapeHtml(raw);
    } else if (field.type === "image" && raw) {
      const safeSrc = escapeHtml(raw);
      replacement =
        field.key === "header.logo"
          ? headerLogoImageHtml(safeSrc)
          : defaultVariableImageHtml(safeSrc);
    }
    out = out.replaceAll(templateVariableToken(field.key), replacement);
  }

  out = out.replace(/<img\b[^>]*\bsrc=""[^>]*\/?>/gi, "");
  out = out.replace(/<td[^>]*data-crm-header-logo[^>]*>\s*<\/td>\s*/gi, "");
  return out;
}

export function resolveTemplateVariableDefaults(input: {
  schema: TemplateVariablesSchema | null | undefined;
  values: Record<string, string> | null | undefined;
  complianceOrganizationName?: string | null;
}): Record<string, string> {
  const out = { ...(input.values ?? {}) };
  if (!input.schema?.fields.length) return out;
  for (const field of input.schema.fields) {
    if (out[field.key]?.trim()) continue;
    if (field.defaultFrom === "compliance.organizationName") {
      const name = input.complianceOrganizationName?.trim();
      if (name) out[field.key] = name;
    }
  }
  return out;
}

export function missingRequiredTemplateVariables(
  schema: TemplateVariablesSchema | null | undefined,
  values: Record<string, string> | null | undefined,
  complianceOrganizationName?: string | null,
): TemplateVariableField[] {
  if (!schema?.fields.length) return [];
  const resolved = resolveTemplateVariableDefaults({
    schema,
    values,
    complianceOrganizationName,
  });
  return schema.fields.filter((f) => {
    if (!f.required) return false;
    return !resolved[f.key]?.trim();
  });
}
