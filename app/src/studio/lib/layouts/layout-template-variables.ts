/**
 * Client mirror of hq/studio `variable-schema.ts` (preview + compose UI).
 */

import {
  defaultBrandLogoUrl,
  footerBrandLogoImageHtml,
} from "@/studio/lib/brand/brand-logo";

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

const LOGO_FOOTER_VARIABLE_KEYS = new Set([
  "brand.logo",
  "header.logo",
  "brand.organization_name",
  "header.organization_name",
]);

/** Shared brand + compliance fields — not per-layout content variables. */
export function isLogoFooterTemplateVariableField(field: TemplateVariableField): boolean {
  if (LOGO_FOOTER_VARIABLE_KEYS.has(field.key)) return true;
  return (
    field.defaultFrom === "compliance.organizationName" && field.key.startsWith("brand.")
  );
}

export function splitTemplateVariableFields(
  schema: TemplateVariablesSchema | null | undefined,
): {
  logoFooterSchema: TemplateVariablesSchema | null;
  layoutSchema: TemplateVariablesSchema | null;
} {
  const fields = schema?.fields ?? [];
  if (!fields.length) {
    return { logoFooterSchema: null, layoutSchema: null };
  }
  const logoFooterFields = fields.filter(isLogoFooterTemplateVariableField);
  const layoutFields = fields.filter((f) => !isLogoFooterTemplateVariableField(f));
  return {
    logoFooterSchema: logoFooterFields.length ? { fields: logoFooterFields } : null,
    layoutSchema: layoutFields.length ? { fields: layoutFields } : null,
  };
}

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

function heroBannerImageHtml(src: string): string {
  return `<img src="${src}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

function authorAvatarImageHtml(src: string): string {
  return `<img src="${src}" alt="" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:50%;object-fit:cover;border:0;outline:none;text-decoration:none;" />`;
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
  options?: { defaultBrandLogoUrl?: string },
): string {
  if (!schema?.fields.length) return html;
  const map = values ?? {};
  let out = html;

  for (const field of schema.fields) {
    const raw = map[field.key]?.trim() ?? "";
    let replacement = "";
    if (field.type === "text") {
      replacement = escapeHtml(raw);
    } else if (field.type === "image") {
      const isBrandLogoField = field.key === "brand.logo" || field.key === "header.logo";
      let src = raw;
      if (!src && isBrandLogoField) {
        src = options?.defaultBrandLogoUrl ?? defaultBrandLogoUrl();
      }
      if (src) {
        const safeSrc = escapeHtml(src);
        replacement =
          field.key === "header.logo"
            ? headerLogoImageHtml(safeSrc)
            : field.key === "brand.logo"
              ? footerBrandLogoImageHtml(safeSrc)
              : field.key === "hero.image"
                ? heroBannerImageHtml(safeSrc)
              : field.key === "author.avatar" || field.key === "host.avatar"
                ? authorAvatarImageHtml(safeSrc)
                : defaultVariableImageHtml(safeSrc);
      }
    }
    out = out.replaceAll(templateVariableToken(field.key), replacement);
  }

  out = out.replace(/<img\b[^>]*\bsrc=""[^>]*\/?>/gi, "");
  out = applyHeaderSlotLogoSizing(out);
  out = out.replace(/<td[^>]*data-studio-header-logo[^>]*>\s*<\/td>\s*/gi, "");
  return out;
}

function applyHeaderSlotLogoSizing(html: string): string {
  return html.replace(
    /<td([^>]*data-studio-header-logo="1"[^>]*)>([\s\S]*?)<\/td>/gi,
    (block, tdAttrs, inner) => {
      const srcMatch = inner.match(/src="([^"]+)"/);
      if (!srcMatch) return block;
      const src = srcMatch[1]!;
      return `<td${tdAttrs}>${headerLogoImageHtml(src)}</td>`;
    },
  );
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

/** Substitute `{{vars.*}}` in plain text (subject, plain-text body) without HTML escaping. */
export function applyTemplateVariablesToPlainText(
  text: string,
  schema: TemplateVariablesSchema | null | undefined,
  values: Record<string, string> | null | undefined,
  options?: { defaultBrandLogoUrl?: string },
): string {
  if (!schema?.fields.length) return text;
  const map = values ?? {};
  let out = text;

  for (const field of schema.fields) {
    const raw = map[field.key]?.trim() ?? "";
    let replacement = "";
    if (field.type === "text") {
      replacement = raw;
    } else if (field.type === "image") {
      const isBrandLogoField = field.key === "brand.logo" || field.key === "header.logo";
      let src = raw;
      if (!src && isBrandLogoField) {
        src = options?.defaultBrandLogoUrl ?? defaultBrandLogoUrl();
      }
      replacement = src;
    }
    out = out.replaceAll(templateVariableToken(field.key), replacement);
  }

  return out;
}

/** Apply layout variables to markdown body HTML or plain-text body before preview/send merge. */
export function applyTemplateVariablesToComposeContent(
  content: string,
  input: {
    plainText: boolean;
    schema: TemplateVariablesSchema | null | undefined;
    values: Record<string, string> | null | undefined;
    defaultBrandLogoUrl?: string;
  },
): string {
  if (input.plainText) {
    return applyTemplateVariablesToPlainText(content, input.schema, input.values, {
      defaultBrandLogoUrl: input.defaultBrandLogoUrl,
    });
  }
  return applyTemplateVariablesToHtml(content, input.schema, input.values, {
    defaultBrandLogoUrl: input.defaultBrandLogoUrl,
  });
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
    if (f.type === "image" && (f.key === "brand.logo" || f.key === "header.logo")) {
      return false;
    }
    return !resolved[f.key]?.trim();
  });
}
