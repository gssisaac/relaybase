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
  const contentHtml = markdownToHtml(input.bodyMarkdown);
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
