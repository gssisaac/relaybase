import type { TemplateVariablesSchema } from "@/scale/lib/layouts/layout-template-variables";

/** Fixed preview fixtures — not editable in the UI. */
export const LAYOUT_PREVIEW_FIXTURES = {
  contactName: "Alex Kim",
  contactEmail: "alex@example.com",
  organizationName: "Acme Inc.",
  postalAddress: "123 Market Street\nSan Francisco, CA 94103",
  complianceContactEmail: "compliance@acme.example.com",
  unsubscribeUrl: "https://example.com/unsubscribe/preview",
  fromEmail: "newsletter@acme.example.com",
  contentBody: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.`,
} as const;

const CONTENT_PARAGRAPH_STYLE =
  "margin:0 0 12px;font-family:sans-serif;font-size:15px;line-height:1.5;color:#334155";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function layoutPreviewContentAsHtml(plainBody: string): string {
  const trimmed = plainBody.trim();
  if (!trimmed) {
    return `<p style='${CONTENT_PARAGRAPH_STYLE}'>Nothing to preview yet</p>`;
  }
  return trimmed
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\n/).map((line) => escapeHtml(line.trim())).join("<br />");
      return `<p style='${CONTENT_PARAGRAPH_STYLE}'>${lines}</p>`;
    })
    .join("");
}

export function hardcodedLayoutTemplateVariables(
  schema: TemplateVariablesSchema | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of schema?.fields ?? []) {
    if (field.type !== "text") continue;
    if (
      field.key === "brand.organization_name" ||
      field.key === "header.organization_name" ||
      field.key === "publication.title" ||
      field.key === "digest.title" ||
      field.key === "receipt.title" ||
      field.key === "event.title" ||
      field.key === "author.name" ||
      field.defaultFrom === "compliance.organizationName"
    ) {
      out[field.key] = LAYOUT_PREVIEW_FIXTURES.organizationName;
    }
    if (field.key === "author.name") {
      out[field.key] = "Alex River";
    }
    if (field.key === "author.title") {
      out[field.key] = "Founder & CEO";
    }
    if (field.key === "receipt.title") {
      out[field.key] = "Payment Receipt";
    }
    if (field.key === "receipt.number") {
      out[field.key] = "INV-2026-0901";
    }
    if (field.key === "event.title") {
      out[field.key] = "Scale 2026 Product Keynote";
    }
    if (field.key === "event.date_badge") {
      out[field.key] = "SEP 24";
    }
    if (field.key === "event.time_location") {
      out[field.key] = "Thu 10:00 AM UTC · Online / Zoom";
    }
    if (field.key === "spotlight.issue") {
      out[field.key] = "NO. 08";
    }
    if (field.key === "spotlight.tagline") {
      out[field.key] = "CURATED SIGNALS & DISPATCHES";
    }
    if (field.key === "publication.issue_meta") {
      out[field.key] = "Issue #48 · Sep 16, 2026";
    }
    if (field.key === "header.badge_text") {
      out[field.key] = "RELEASE NOTE";
    }
    if (field.key === "header.greeting_tag") {
      out[field.key] = "Community letter";
    }
    if (field.key === "digest.read_time") {
      out[field.key] = "4 min read";
    }
    if (field.key === "digest.edition") {
      out[field.key] = "Weekly edition #14";
    }
  }
  return out;
}
