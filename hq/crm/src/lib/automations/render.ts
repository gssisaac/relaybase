import { marked } from "marked";

import { isPlainTextTemplate } from "../templates/builtin-templates";
import { prepareBroadcastTemplateHtml } from "../templates/standard-footer";
import {
  applyTemplateVariablesToHtml,
  type TemplateVariablesSchema,
} from "../templates/variable-schema";
import { applyGmailContentLinkStyles } from "../render/gmail-link-style";
import { applyAutomationComplianceMergeTags, shouldIncludeListUnsubscribe } from "./compliance";
import { applyAutomationRecipientMergeTags, applyTriggerMergeTags } from "./merge-tags";
import type { Automation } from "../../db/types";

function automationAssetStem(automationId: string): string {
  return automationId.replace(/^automation_/, "").slice(0, 32) || "automation";
}

function resolveRelativeAutomationAssetUrl(
  automationId: string,
  crmBaseUrl: string,
  href: string,
): string | null {
  if (!href || /^(https?:|data:|blob:)/i.test(href)) return null;
  const relative = href.replace(/^\.\//, "");
  const folder = `.${automationAssetStem(automationId)}`;
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;
  return `${crmBaseUrl}/crm/assets/automation/${encodeURIComponent(automationId)}/${encodeURIComponent(filename)}`;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc="([^"]*)"/i;
const ALT_ATTR_RE = /\balt="[^"]*"/i;
const STYLE_ATTR_RE = /\bstyle="([^"]*)"/i;
const EMAIL_IMG_STYLE = "display:block;max-width:100%;height:auto;";

function sanitizeAutomationContentImages(
  html: string,
  automationId: string,
  crmBaseUrl: string,
): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = tag.match(SRC_ATTR_RE)?.[1] ?? "";
    if (/^data:image\//i.test(src)) return "";

    let nextTag = tag;
    const resolved = resolveRelativeAutomationAssetUrl(automationId, crmBaseUrl, src);
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

function markdownToHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  return typeof out === "string" ? out : "";
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shouldSkipClickTracking(url: string): boolean {
  return !url || url.startsWith("mailto:") || url.startsWith("#") || url.includes("/crm/t/");
}

function applyAllMergeTags(
  text: string,
  recipient: { email: string; name?: string | null },
  payload: Record<string, unknown>,
): string {
  let out = applyAutomationRecipientMergeTags(text, recipient);
  out = applyTriggerMergeTags(out, payload);
  return out;
}

export type RenderAutomationInput = {
  automation: Automation;
  automationSendId: string;
  templateHtml: string;
  templateVariablesSchema?: TemplateVariablesSchema | null;
  recipient: { email: string; name?: string | null };
  payload: Record<string, unknown>;
  crmBaseUrl: string;
};

export function renderAutomationForSend(input: RenderAutomationInput): string {
  const { automation, automationSendId, templateHtml, crmBaseUrl } = input;
  const automationId = automation.id;

  let shell = prepareBroadcastTemplateHtml(templateHtml, automation.templateId);
  shell = applyTemplateVariablesToHtml(
    shell,
    input.templateVariablesSchema,
    automation.templateVariables,
    { broadcastId: automationId, crmBaseUrl },
  );

  const openPixel = `${crmBaseUrl}/crm/t/a/o/${automationId}/${automationSendId}`;

  if (isPlainTextTemplate(automation.templateId)) {
    const merged = applyAllMergeTags(
      shell.replaceAll("{{content}}", automation.bodyMarkdown ?? ""),
      input.recipient,
      input.payload,
    );
    let html = `<div style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">${escapeHtml(merged)}</div>`;
    html = applyAutomationComplianceMergeTags(html, automationId);
    return `${html}<img src="${openPixel}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  }

  const contentHtml = sanitizeAutomationContentImages(
    applyGmailContentLinkStyles(markdownToHtml(automation.bodyMarkdown)),
    automationId,
    crmBaseUrl,
  );

  let html = shell.replaceAll("{{content}}", contentHtml);
  html = applyAllMergeTags(html, input.recipient, input.payload);
  html = applyAutomationComplianceMergeTags(html, automationId);

  html = html.replace(/href="([^"]*)"/g, (match, url: string) => {
    if (shouldSkipClickTracking(url)) return match;
    const redirect = `${crmBaseUrl}/crm/t/a/c/${automationId}/${automationSendId}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  html += `<img src="${openPixel}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  return html;
}

export function buildAutomationListUnsubscribeUrl(
  crmBaseUrl: string,
  automationId: string,
  token: string,
): string {
  return `${crmBaseUrl}/crm/unsubscribe/automation/${automationId}/${token}`;
}

export function automationSendMailOptions(automation: Automation): {
  includeListUnsubscribe: boolean;
} {
  return { includeListUnsubscribe: shouldIncludeListUnsubscribe(automation) };
}
