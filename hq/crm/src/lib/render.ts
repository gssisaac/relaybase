import { marked } from "marked";
import { memberKeyFromEmail } from "./member-key";

/**
 * P0-6 rendering pipeline, steps 1-4 (docs/features/crm-mode-v0.2.md §4 P0-6):
 * markdown → HTML fragment, merge into template's `{{content}}`, merge tags,
 * then tracking pixel/redirects (P0-2).
 */

export function markdownToHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  return typeof out === "string" ? out : "";
}

/** Mirrors app/src/lib/markdown-editor/utils/assets.ts campaignAssetStem (no DOM/browser deps here). */
function campaignAssetStem(campaignId: string): string {
  return campaignId.replace(/^campaign_/, "").slice(0, 32) || "campaign";
}

/** Resolve a page-relative `./.{stem}/{filename}` href to an absolute CDN asset URL, or null if not one. */
function resolveRelativeCampaignAssetUrl(
  campaignId: string,
  crmBaseUrl: string,
  href: string,
): string | null {
  if (!href || /^(https?:|data:|blob:)/i.test(href)) return null;
  const relative = href.replace(/^\.\//, "");
  const folder = `.${campaignAssetStem(campaignId)}`;
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;
  return `${crmBaseUrl}/crm/assets/${encodeURIComponent(campaignId)}/${encodeURIComponent(filename)}`;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc="([^"]*)"/i;
const ALT_ATTR_RE = /\balt="[^"]*"/i;
const STYLE_ATTR_RE = /\bstyle="([^"]*)"/i;
const EMAIL_IMG_STYLE = "display:block;max-width:100%;height:auto;";

/**
 * Send-time image safety guards (docs/features/crm-email-image-asset-cdn-spec.md UC-5):
 * - Rewrites page-relative asset paths to absolute HTTPS CDN URLs.
 * - Strips any Base64 data URI (Gmail/Outlook block or corrupt these outright).
 * - Adds mandatory email-safe `alt`/`style` attributes for Outlook/Gmail rendering.
 */
export function sanitizeCampaignContentImages(
  html: string,
  campaignId: string,
  crmBaseUrl: string,
): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = tag.match(SRC_ATTR_RE)?.[1] ?? "";
    if (/^data:image\//i.test(src)) return "";

    let nextTag = tag;
    const resolved = resolveRelativeCampaignAssetUrl(campaignId, crmBaseUrl, src);
    if (resolved) {
      nextTag = nextTag.replace(SRC_ATTR_RE, `src="${resolved}"`);
    }

    if (!ALT_ATTR_RE.test(nextTag)) {
      nextTag = nextTag.replace(/^<img\b/i, '<img alt=""');
    }

    if (STYLE_ATTR_RE.test(nextTag)) {
      nextTag = nextTag.replace(STYLE_ATTR_RE, (_match, existing: string) => {
        const merged = existing.trim().replace(/;\s*$/, "");
        return `style="${merged ? `${merged};` : ""}${EMAIL_IMG_STYLE}"`;
      });
    } else {
      nextTag = nextTag.replace(/^<img\b/i, `<img style="${EMAIL_IMG_STYLE}"`);
    }

    return nextTag;
  });
}

export type RenderRecipientInput = {
  email: string;
  name?: string | null;
};

export type RenderCampaignInput = {
  campaignId: string;
  bodyMarkdown: string;
  templateHtml: string;
  recipient: RenderRecipientInput;
  crmBaseUrl: string;
};

export function renderCampaignForRecipient(input: RenderCampaignInput): string {
  const contentHtml = sanitizeCampaignContentImages(
    markdownToHtml(input.bodyMarkdown),
    input.campaignId,
    input.crmBaseUrl,
  );
  const memberKey = memberKeyFromEmail(input.recipient.email);
  const unsubscribeUrl = `${input.crmBaseUrl}/crm/unsubscribe/${memberKey}`;

  let html = input.templateHtml
    .replaceAll("{{content}}", contentHtml)
    .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);

  const displayName =
    input.recipient.name?.trim() ||
    input.recipient.email.split("@")[0] ||
    input.recipient.email;
  html = html
    .replaceAll("{{contact.name}}", displayName)
    .replaceAll("{{contact.email}}", input.recipient.email);

  html = html.replace(/href="([^"]*)"/g, (match, url: string) => {
    if (!url || url.startsWith("mailto:") || url.startsWith("#") || url.includes("/crm/t/")) {
      return match;
    }
    const redirect = `${input.crmBaseUrl}/crm/t/c/${input.campaignId}/${memberKey}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  const pixelUrl = `${input.crmBaseUrl}/crm/t/o/${input.campaignId}/${memberKey}`;
  html += `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  return html;
}

/** @deprecated use renderCampaignForRecipient */
export function renderCampaignForContact(input: {
  campaignId: string;
  bodyMarkdown: string;
  templateHtml: string;
  contact: { id: string; email: string; name?: string | null };
  crmBaseUrl: string;
}): string {
  return renderCampaignForRecipient({
    campaignId: input.campaignId,
    bodyMarkdown: input.bodyMarkdown,
    templateHtml: input.templateHtml,
    recipient: { email: input.contact.email, name: input.contact.name },
    crmBaseUrl: input.crmBaseUrl,
  });
}
