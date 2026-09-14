import { marked } from "marked";

/**
 * P0-6 rendering pipeline, steps 1-4 (docs/features/crm-mode-v0.2.md §4 P0-6):
 * markdown → HTML fragment, merge into template's `{{content}}`, merge tags,
 * then tracking pixel/redirects (P0-2). CSS inlining (`juice` in the spec) is
 * intentionally skipped in this pass — cosmetic/deliverability polish, not
 * core mechanics.
 */

export function markdownToHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  return typeof out === "string" ? out : "";
}

export type RenderContactInput = {
  id: string;
  email: string;
  name?: string | null;
};

export type RenderCampaignInput = {
  campaignId: string;
  bodyMarkdown: string;
  templateHtml: string;
  contact: RenderContactInput;
  crmBaseUrl: string;
};

export function renderCampaignForContact(input: RenderCampaignInput): string {
  const contentHtml = markdownToHtml(input.bodyMarkdown);
  const unsubscribeUrl = `${input.crmBaseUrl}/crm/unsubscribe/${input.contact.id}`;

  let html = input.templateHtml
    .replaceAll("{{content}}", contentHtml)
    .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);

  const displayName =
    input.contact.name?.trim() || input.contact.email.split("@")[0] || input.contact.email;
  html = html
    .replaceAll("{{contact.name}}", displayName)
    .replaceAll("{{contact.email}}", input.contact.email);

  html = html.replace(/href="([^"]*)"/g, (match, url: string) => {
    if (!url || url.startsWith("mailto:") || url.startsWith("#") || url.includes("/crm/t/")) {
      return match;
    }
    const redirect = `${input.crmBaseUrl}/crm/t/c/${input.campaignId}/${input.contact.id}?u=${encodeURIComponent(url)}`;
    return `href="${redirect}"`;
  });

  const pixelUrl = `${input.crmBaseUrl}/crm/t/o/${input.campaignId}/${input.contact.id}`;
  html += `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  return html;
}
