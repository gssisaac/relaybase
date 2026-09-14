import { marked } from "marked";

/**
 * P0-6 rendering pipeline: markdown → HTML fragment, merge into template's
 * `{{content}}`, merge merge tags, then tracking pixel/redirects (P0-2),
 * scoped to a single Broadcast send to a single Recipient (crm-campaign-
 * broadcast-subscriber-model.md §2, §3.4).
 */

export function markdownToHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  return typeof out === "string" ? out : "";
}

export type RenderRecipientInput = {
  email: string;
  name?: string | null;
};

export type RenderBroadcastInput = {
  campaignId: string;
  broadcastId: string;
  recipientId: string;
  bodyMarkdown: string;
  templateHtml: string;
  recipient: RenderRecipientInput;
  unsubscribeToken: string;
  crmBaseUrl: string;
};

export function renderBroadcastForRecipient(input: RenderBroadcastInput): string {
  const contentHtml = markdownToHtml(input.bodyMarkdown);
  const unsubscribeUrl = `${input.crmBaseUrl}/crm/unsubscribe/${input.campaignId}/${input.unsubscribeToken}`;

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
    const redirect = `${input.crmBaseUrl}/crm/t/c/${input.broadcastId}/${input.recipientId}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  const pixelUrl = `${input.crmBaseUrl}/crm/t/o/${input.broadcastId}/${input.recipientId}`;
  html += `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  return html;
}
