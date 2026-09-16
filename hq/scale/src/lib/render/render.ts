import { marked } from "marked";

import { applyComplianceMergeTags } from "../compliance/footer";
import { prepareBroadcastTemplateHtml } from "../templates/standard-footer";
import { isPlainTextTemplate } from "../templates/builtin-templates";
import {
  applyTemplateVariablesToHtml,
  type TemplateVariablesSchema,
} from "../templates/variable-schema";
import { applyGmailContentLinkStyles } from "./gmail-link-style";

/**
 * P0-6 rendering pipeline: markdown → HTML fragment, merge into template's
 * `{{content}}`, merge merge tags, then tracking pixel/redirects (P0-2),
 * scoped to a single Newsletter send to a single Recipient.
 */

export function markdownToHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  return typeof out === "string" ? out : "";
}

/** Mirrors app/src/lib/markdown-editor/utils/assets.ts newsletterAssetStem (no DOM/browser deps here). */
function newsletterAssetStem(broadcastId: string): string {
  return broadcastId.replace(/^broadcast_/, "").slice(0, 32) || "broadcast";
}

/** Resolve a page-relative `./.{stem}/{filename}` href to an absolute CDN asset URL, or null if not one. */
function resolveRelativeNewsletterAssetUrl(
  broadcastId: string,
  scaleBaseUrl: string,
  href: string,
): string | null {
  if (!href || /^(https?:|data:|blob:)/i.test(href)) return null;
  const relative = href.replace(/^\.\//, "");
  const folder = `.${newsletterAssetStem(broadcastId)}`;
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;
  return `${scaleBaseUrl}/scale/assets/${encodeURIComponent(broadcastId)}/${encodeURIComponent(filename)}`;
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
export function sanitizeNewsletterContentImages(
  html: string,
  broadcastId: string,
  scaleBaseUrl: string,
): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = tag.match(SRC_ATTR_RE)?.[1] ?? "";
    if (/^data:image\//i.test(src)) return "";

    let nextTag = tag;
    const resolved = resolveRelativeNewsletterAssetUrl(broadcastId, scaleBaseUrl, src);
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

export type RenderBroadcastInput = {
  broadcastId: string;
  recipientId: string;
  bodyMarkdown: string;
  templateId?: string | null;
  templateHtml: string;
  templateVariablesSchema?: TemplateVariablesSchema | null;
  templateVariables?: Record<string, string> | null;
  recipient: RenderRecipientInput;
  unsubscribeToken: string;
  scaleBaseUrl: string;
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyRecipientMergeTags(
  text: string,
  recipient: RenderRecipientInput,
  unsubscribeUrl: string,
): string {
  const displayName =
    recipient.name?.trim() ||
    recipient.email.split("@")[0] ||
    recipient.email;
  return text
    .replaceAll("{{contact.name}}", displayName)
    .replaceAll("{{contact.email}}", recipient.email)
    .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);
}

function shouldSkipClickTracking(url: string, unsubscribeUrl: string): boolean {
  if (!url || url.startsWith("mailto:") || url.startsWith("#") || url.includes("/scale/t/")) {
    return true;
  }
  if (url.includes("/scale/unsubscribe/")) return true;
  if (url === unsubscribeUrl) return true;
  return false;
}

export function buildListUnsubscribeUrl(
  scaleBaseUrl: string,
  broadcastId: string,
  unsubscribeToken: string,
): string {
  return `${scaleBaseUrl}/scale/unsubscribe/${broadcastId}/${unsubscribeToken}`;
}

export function renderNewsletterForRecipient(input: RenderBroadcastInput): string {
  const unsubscribeUrl = buildListUnsubscribeUrl(
    input.scaleBaseUrl,
    input.broadcastId,
    input.unsubscribeToken,
  );

  let templateHtml = prepareBroadcastTemplateHtml(
    input.templateHtml,
    input.templateId,
  );

  templateHtml = applyTemplateVariablesToHtml(
    templateHtml,
    input.templateVariablesSchema,
    input.templateVariables,
    { broadcastId: input.broadcastId, scaleBaseUrl: input.scaleBaseUrl },
  );

  if (isPlainTextTemplate(input.templateId)) {
    const merged = applyRecipientMergeTags(
      templateHtml.replaceAll("{{content}}", input.bodyMarkdown ?? ""),
      input.recipient,
      unsubscribeUrl,
    );
    let html = `<div style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">${escapeHtml(merged)}</div>`;
    html = applyComplianceMergeTags(html, input.broadcastId);
    const pixelUrl = `${input.scaleBaseUrl}/scale/t/o/${input.broadcastId}/${input.recipientId}`;
    return `${html}<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  }

  const contentHtml = sanitizeNewsletterContentImages(
    applyGmailContentLinkStyles(markdownToHtml(input.bodyMarkdown)),
    input.broadcastId,
    input.scaleBaseUrl,
  );

  let html = templateHtml
    .replaceAll("{{content}}", contentHtml)
    .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);

  html = applyRecipientMergeTags(html, input.recipient, unsubscribeUrl);
  html = applyComplianceMergeTags(html, input.broadcastId);

  html = html.replace(/href="([^"]*)"/g, (match, url: string) => {
    if (shouldSkipClickTracking(url, unsubscribeUrl)) return match;
    const redirect = `${input.scaleBaseUrl}/scale/t/c/${input.broadcastId}/${input.recipientId}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  const pixelUrl = `${input.scaleBaseUrl}/scale/t/o/${input.broadcastId}/${input.recipientId}`;
  html += `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  return html;
}
