import { marked } from "marked";

import { isPlainTextTemplate } from "../templates/builtin-templates";
import { prepareBroadcastTemplateHtml } from "../templates/standard-footer";
import {
  applyTemplateVariablesToHtml,
  type TemplateVariablesSchema,
} from "../templates/variable-schema";
import { applyGmailContentLinkStyles } from "../render/gmail-link-style";
import { applyTriggerComplianceMergeTags, shouldIncludeListUnsubscribe } from "./compliance";
import { applyAutomationRecipientMergeTags, applyTriggerMergeTags } from "./merge-tags";
import { store } from "../../db/store";
import type { Trigger } from "../../db/types";
import { requireMessage } from "../messages/resolve";

function triggerAssetStem(triggerId: string): string {
  return triggerId.replace(/^automation_/, "").slice(0, 32) || "automation";
}

function resolveRelativeTriggerAssetUrl(
  triggerId: string,
  scaleBaseUrl: string,
  href: string,
): string | null {
  if (!href || /^(https?:|data:|blob:)/i.test(href)) return null;
  const relative = href.replace(/^\.\//, "");
  const folder = `.${triggerAssetStem(triggerId)}`;
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;
  return `${scaleBaseUrl}/scale/assets/trigger/${encodeURIComponent(triggerId)}/${encodeURIComponent(filename)}`;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc="([^"]*)"/i;
const ALT_ATTR_RE = /\balt="[^"]*"/i;
const STYLE_ATTR_RE = /\bstyle="([^"]*)"/i;
const EMAIL_IMG_STYLE = "display:block;max-width:100%;height:auto;";

function sanitizeTriggerContentImages(
  html: string,
  triggerId: string,
  scaleBaseUrl: string,
): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = tag.match(SRC_ATTR_RE)?.[1] ?? "";
    if (/^data:image\//i.test(src)) return "";

    let nextTag = tag;
    const resolved = resolveRelativeTriggerAssetUrl(triggerId, scaleBaseUrl, src);
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
  return !url || url.startsWith("mailto:") || url.startsWith("#") || url.includes("/scale/t/");
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
  automation: Trigger;
  triggerSendId: string;
  templateHtml: string;
  templateVariablesSchema?: TemplateVariablesSchema | null;
  recipient: { email: string; name?: string | null };
  payload: Record<string, unknown>;
  scaleBaseUrl: string;
};

export function renderTriggerForSend(input: RenderAutomationInput): string {
  const { automation, triggerSendId, templateHtml, scaleBaseUrl } = input;
  const triggerId = automation.id;
  const data = store.read();
  const message = requireMessage(data, automation.templateId);
  const layoutId = message.layoutId ?? "tpl-minimal";

  let shell = prepareBroadcastTemplateHtml(templateHtml, layoutId);
  shell = applyTemplateVariablesToHtml(
    shell,
    input.templateVariablesSchema,
    message.templateVariables,
    { broadcastId: triggerId, scaleBaseUrl },
  );

  const openPixel = `${scaleBaseUrl}/scale/t/a/o/${triggerId}/${triggerSendId}`;

  if (isPlainTextTemplate(layoutId)) {
    const merged = applyAllMergeTags(
      shell.replaceAll("{{content}}", message.bodyMarkdown ?? ""),
      input.recipient,
      input.payload,
    );
    let html = `<div style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">${escapeHtml(merged)}</div>`;
    html = applyTriggerComplianceMergeTags(html, triggerId);
    return `${html}<img src="${openPixel}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  }

  const contentHtml = sanitizeTriggerContentImages(
    applyGmailContentLinkStyles(markdownToHtml(message.bodyMarkdown)),
    triggerId,
    scaleBaseUrl,
  );

  let html = shell.replaceAll("{{content}}", contentHtml);
  html = applyAllMergeTags(html, input.recipient, input.payload);
  html = applyTriggerComplianceMergeTags(html, triggerId);

  html = html.replace(/href="([^"]*)"/g, (match, url: string) => {
    if (shouldSkipClickTracking(url)) return match;
    const redirect = `${scaleBaseUrl}/scale/t/a/c/${triggerId}/${triggerSendId}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  html += `<img src="${openPixel}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  return html;
}

export function buildTriggerListUnsubscribeUrl(
  scaleBaseUrl: string,
  triggerId: string,
  token: string,
): string {
  return `${scaleBaseUrl}/scale/unsubscribe/automation/${triggerId}/${token}`;
}

export function triggerSendMailOptions(automation: Trigger): {
  includeListUnsubscribe: boolean;
} {
  return { includeListUnsubscribe: shouldIncludeListUnsubscribe(automation) };
}
