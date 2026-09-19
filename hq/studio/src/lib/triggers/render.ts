import { marked } from "marked";

import { isPlainTextTemplate } from "@lib/templates/builtin-templates";
import { prepareBroadcastTemplateHtml } from "@lib/templates/standard-footer";
import {
  applyTemplateVariablesToHtml,
  applyTemplateVariablesToPlainText,
  type TemplateVariablesSchema,
} from "@lib/templates/variable-schema";
import { applyGmailContentLinkStyles } from "@lib/render/gmail-link-style";
import { transformEmailButtonMarkersToBulletproof } from "../render/email-button-html.js";
import { transformYouTubeEmbedsToHtml } from "../render/youtube.js";
import { wrapLayoutBodyHtml } from "@lib/render/layout-content-theme";
import { markdownToPlainEmailText } from "@lib/render/markdown-to-plain-email-text";
import { applyTriggerComplianceMergeTags, shouldIncludeListUnsubscribe } from "@lib/triggers/compliance";
import { applyAutomationRecipientMergeTags, applyTriggerMergeTags } from "@lib/triggers/merge-tags";
import type { Trigger } from "@db/types";
import { requireMessage } from "@lib/messages/resolve";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

function triggerAssetStem(triggerId: string): string {
  return triggerId.replace(/^automation_/, "").slice(0, 32) || "automation";
}

function resolveRelativeTriggerAssetUrl(
  triggerId: string,
  studioBaseUrl: string,
  href: string,
): string | null {
  if (!href || /^(https?:|data:|blob:)/i.test(href)) return null;
  const relative = href.replace(/^\.\//, "");
  const folder = `.${triggerAssetStem(triggerId)}`;
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;
  return `${studioBaseUrl}/studio/assets/trigger/${encodeURIComponent(triggerId)}/${encodeURIComponent(filename)}`;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc="([^"]*)"/i;
const ALT_ATTR_RE = /\balt="[^"]*"/i;
const STYLE_ATTR_RE = /\bstyle="([^"]*)"/i;
const EMAIL_IMG_STYLE = "display:block;max-width:100%;height:auto;";

function sanitizeTriggerContentImages(
  html: string,
  triggerId: string,
  studioBaseUrl: string,
): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = tag.match(SRC_ATTR_RE)?.[1] ?? "";
    if (/^data:image\//i.test(src)) return "";

    let nextTag = tag;
    const resolved = resolveRelativeTriggerAssetUrl(triggerId, studioBaseUrl, src);
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
  const html = typeof out === "string" ? out : "";
  return transformYouTubeEmbedsToHtml(
    transformEmailButtonMarkersToBulletproof(html),
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shouldSkipClickTracking(url: string): boolean {
  return !url || url.startsWith("mailto:") || url.startsWith("#") || url.includes("/studio/t/");
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
  studioBaseUrl: string;
};

export function renderTriggerForSend(input: RenderAutomationInput): string {
  const { automation, triggerSendId, templateHtml, studioBaseUrl } = input;
  const triggerId = automation.id;
  const data = readStudioDocument();
  const message = requireMessage(data, automation.messageId);
  const layoutId = message.layoutId ?? "tpl-minimal";

  let shell = prepareBroadcastTemplateHtml(templateHtml, layoutId);
  shell = applyTemplateVariablesToHtml(
    shell,
    input.templateVariablesSchema,
    message.templateVariables,
    { broadcastId: triggerId, studioBaseUrl },
  );

  const openPixel = `${studioBaseUrl}/studio/t/a/o/${triggerId}/${triggerSendId}`;
  const varContext = { broadcastId: triggerId, studioBaseUrl };

  if (isPlainTextTemplate(layoutId)) {
    const plainBody = markdownToPlainEmailText(message.bodyMarkdown ?? "");
    let merged = shell.replaceAll("{{content}}", plainBody);
    merged = applyTemplateVariablesToPlainText(
      merged,
      input.templateVariablesSchema,
      message.templateVariables,
      varContext,
    );
    merged = applyAllMergeTags(merged, input.recipient, input.payload);
    let html = `<div style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">${escapeHtml(merged)}</div>`;
    html = applyTriggerComplianceMergeTags(html, triggerId);
    return `${html}<img src="${openPixel}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  }

  const contentHtml = wrapLayoutBodyHtml(
    sanitizeTriggerContentImages(
      applyGmailContentLinkStyles(markdownToHtml(message.bodyMarkdown)),
      triggerId,
      studioBaseUrl,
    ),
    layoutId,
  );

  let html = shell.replaceAll("{{content}}", contentHtml);
  html = applyTemplateVariablesToHtml(
    html,
    input.templateVariablesSchema,
    message.templateVariables,
    varContext,
  );
  html = applyAllMergeTags(html, input.recipient, input.payload);
  html = applyTriggerComplianceMergeTags(html, triggerId);

  html = html.replace(/href="([^"]*)"/g, (match, url: string) => {
    if (shouldSkipClickTracking(url)) return match;
    const redirect = `${studioBaseUrl}/studio/t/a/c/${triggerId}/${triggerSendId}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  html += `<img src="${openPixel}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  return html;
}

export function buildTriggerListUnsubscribeUrl(
  studioBaseUrl: string,
  triggerId: string,
  token: string,
): string {
  return `${studioBaseUrl}/studio/unsubscribe/automation/${triggerId}/${token}`;
}

export function triggerSendMailOptions(automation: Trigger): {
  includeListUnsubscribe: boolean;
} {
  return { includeListUnsubscribe: shouldIncludeListUnsubscribe(automation) };
}
