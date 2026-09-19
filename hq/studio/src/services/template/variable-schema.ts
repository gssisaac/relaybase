import { resolveStudioAssetUrl } from "@services/asset/resolve-url";
import {
  defaultBrandLogoUrl,
  footerBrandLogoImageHtml,
} from "@services/template/brand-logo";

/**
 * Per-template variable definitions (authoring format may be YAML on import;
 * stored and served as JSON on `Template.variablesSchema`).
 */

export type TemplateVariableType = "text" | "image";

export type TemplateVariableDefaultFrom = "compliance.organizationName";

export type TemplateVariableField = {
  key: string;
  type: TemplateVariableType;
  label: string;
  description?: string;
  required?: boolean;
  /** Prefill from broadcast/account context when the stored value is empty. */
  defaultFrom?: TemplateVariableDefaultFrom;
};

export type TemplateVariablesSchema = {
  fields: TemplateVariableField[];
};

const FIELD_KEY_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)*$/;

/** Sanitize user-supplied layout variable values from API PATCH bodies. */
export function sanitizeTemplateVariables(
  raw: Record<string, string> | undefined,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    if (!FIELD_KEY_RE.test(key)) continue;
    out[key] = value.trim();
  }
  return out;
}

export function normalizeTemplateVariablesSchema(
  input: TemplateVariablesSchema | null | undefined,
): TemplateVariablesSchema | null {
  if (!input?.fields?.length) return null;
  const fields = input.fields.filter((f) => f.key && FIELD_KEY_RE.test(f.key));
  return fields.length ? { fields } : null;
}

/** Minimal YAML subset for custom template import (no external parser). */
export function parseTemplateVariablesYaml(yaml: string): TemplateVariablesSchema | null {
  const trimmed = yaml.trim();
  if (!trimmed) return null;

  const fields: TemplateVariableField[] = [];
  let current: Partial<TemplateVariableField> | null = null;

  for (const rawLine of trimmed.split("\n")) {
    const line = rawLine.replace(/\s+#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item) {
      if (current?.key && current.type && current.label) {
        fields.push(current as TemplateVariableField);
      }
      current = {};
      const inline = item[1]?.trim();
      if (inline?.includes(":")) {
        const [k, ...rest] = inline.split(":");
        applyYamlField(current, k.trim(), rest.join(":").trim());
      }
      continue;
    }
    const kv = line.match(/^\s{2,}(\w+):\s*(.*)$/);
    if (kv && current) {
      applyYamlField(current, kv[1]!, unquoteYamlValue(kv[2]!.trim()));
    }
  }
  if (current?.key && current.type && current.label) {
    fields.push(current as TemplateVariableField);
  }

  return normalizeTemplateVariablesSchema({ fields });
}

function unquoteYamlValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function applyYamlField(
  field: Partial<TemplateVariableField>,
  key: string,
  value: string,
): void {
  switch (key) {
    case "key":
      field.key = value;
      break;
    case "type":
      if (value === "text" || value === "image") field.type = value;
      break;
    case "label":
      field.label = value;
      break;
    case "description":
      field.description = value || undefined;
      break;
    case "required":
      field.required = value === "true" || value === "yes";
      break;
    case "defaultFrom":
      if (value === "compliance.organizationName") field.defaultFrom = value;
      break;
    default:
      break;
  }
}

export function templateVariableToken(key: string): string {
  return `{{vars.${key}}}`;
}

/** Typical email header logo slot (any source image scales into this box). */
export const HEADER_LOGO_MAX_WIDTH_PX = 120;
export const HEADER_LOGO_HEIGHT_PX = 40;

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

export type ApplyTemplateVariablesContext = {
  broadcastId: string;
  studioBaseUrl: string;
};

/** Substitute `{{vars.*}}` in plain text (subject, plain-text body) without HTML escaping. */
export function applyTemplateVariablesToPlainText(
  text: string,
  schema: TemplateVariablesSchema | null | undefined,
  values: Record<string, string> | null | undefined,
  context?: ApplyTemplateVariablesContext,
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
        src = defaultBrandLogoUrl(context?.studioBaseUrl);
      }
      if (src && context && !/^(https?:|data:|blob:)/i.test(src)) {
        const resolved = resolveStudioAssetUrl(context.broadcastId, context.studioBaseUrl, src);
        if (resolved) src = resolved;
      }
      replacement = src;
    }
    out = out.replaceAll(templateVariableToken(field.key), replacement);
  }

  return out;
}

/** Substitute `{{vars.*}}` in the template shell (before body merge). */
export function applyTemplateVariablesToHtml(
  html: string,
  schema: TemplateVariablesSchema | null | undefined,
  values: Record<string, string> | null | undefined,
  context?: ApplyTemplateVariablesContext,
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
        src = defaultBrandLogoUrl(context?.studioBaseUrl);
      }
      if (src) {
        if (context && !/^(https?:|data:|blob:)/i.test(src)) {
          const resolved = resolveStudioAssetUrl(context.broadcastId, context.studioBaseUrl, src);
          if (resolved) src = resolved;
        }
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
  // Header template: drop logo column when unset so org name aligns left.
  out = out.replace(
    /<td[^>]*data-studio-header-logo[^>]*>\s*<\/td>\s*/gi,
    "",
  );
  return out;
}

/** Footer-sized `brand.logo` img tags in the header row use the larger header slot. */
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
