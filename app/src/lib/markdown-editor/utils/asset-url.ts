import { getCrmApiBase } from "@/lib/crm/api-base";

/** Fix legacy upload URLs that encoded `campaignId/filename` as one path segment. */
export function normalizeCampaignAssetUrl(url: string): string {
  if (!/^https?:/i.test(url)) return url;
  try {
    const u = new URL(url);
    const legacy = u.pathname.match(/^\/crm\/assets\/([^/]+)$/);
    if (legacy?.[1]?.includes("%2F")) {
      const parts = decodeURIComponent(legacy[1]).split("/");
      const campaignId = parts[0];
      const filename = parts.slice(1).join("/");
      if (campaignId && filename) {
        return `${getCrmApiBase()}/crm/assets/${encodeURIComponent(campaignId)}/${encodeURIComponent(filename)}`;
      }
    }
  } catch {
    /* ignore */
  }
  return url;
}

export function normalizeCampaignAssetUrlsInHtml(html: string): string {
  return html.replace(
    /(<img[^>]+src=")([^"]+)(")/gi,
    (_match, before: string, src: string, after: string) =>
      `${before}${normalizeCampaignAssetUrl(src)}${after}`,
  );
}
