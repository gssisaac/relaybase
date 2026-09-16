import { getStudioApiBase } from "@/lib/studio/api-base";

const STUDIO_ASSET_PATH_RE = /^\/studio\/assets(\/|$)/;

/**
 * Editor/preview should load assets via the same origin as `studioFetch` (local Next
 * proxy in dev). Upload responses use `STUDIO_PUBLIC_BASE_URL` (relaybase.email),
 * which 404s for assets that only exist in local hq/studio store.json.
 */
export function normalizeNewsletterAssetUrl(url: string): string {
  if (!/^https?:/i.test(url)) return url;
  try {
    const u = new URL(url);
    if (STUDIO_ASSET_PATH_RE.test(u.pathname)) {
      return `${getStudioApiBase()}${u.pathname}${u.search}`;
    }
    const legacy = u.pathname.match(/^\/studio\/assets\/([^/]+)$/);
    if (legacy?.[1]?.includes("%2F")) {
      const parts = decodeURIComponent(legacy[1]).split("/");
      const newsletterId = parts[0];
      const filename = parts.slice(1).join("/");
      if (newsletterId && filename) {
        return `${getStudioApiBase()}/studio/assets/${encodeURIComponent(newsletterId)}/${encodeURIComponent(filename)}`;
      }
    }
  } catch {
    /* ignore */
  }
  return url;
}

export function normalizeNewsletterAssetUrlsInHtml(html: string): string {
  return html.replace(
    /(<img[^>]+src=")([^"]+)(")/gi,
    (_match, before: string, src: string, after: string) =>
      `${before}${normalizeNewsletterAssetUrl(src)}${after}`,
  );
}
