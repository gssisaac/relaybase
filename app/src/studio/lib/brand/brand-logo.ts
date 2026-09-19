import { STUDIO_PUBLIC_LINK_ORIGIN } from "@/studio/lib/studio-origin";

export const DEFAULT_BRAND_LOGO_FILENAME = "relaybase-icon.png";

/** Relative path on the web app origin (works in Studio preview iframes). */
export const DEFAULT_BRAND_LOGO_PATH = `/studio/brand/${DEFAULT_BRAND_LOGO_FILENAME}`;

export function studioPublicLinkOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return STUDIO_PUBLIC_LINK_ORIGIN.replace(/\/$/, "");
}

/** Relative in the browser; absolute when rendered on the server (thumbnails, OG, etc.). */
export function defaultBrandLogoUrl(publicOrigin?: string): string {
  if (typeof window !== "undefined" && !publicOrigin) {
    return DEFAULT_BRAND_LOGO_PATH;
  }
  const base = (publicOrigin ?? studioPublicLinkOrigin()).replace(/\/$/, "");
  return `${base}${DEFAULT_BRAND_LOGO_PATH}`;
}

export const FOOTER_LOGO_MAX_WIDTH_PX = 80;
export const FOOTER_LOGO_HEIGHT_PX = 24;

export function footerBrandLogoImageHtml(src: string): string {
  const w = FOOTER_LOGO_MAX_WIDTH_PX;
  const h = FOOTER_LOGO_HEIGHT_PX;
  return `<img src="${src}" alt="" width="${w}" height="${h}" style="display:block;border:0;outline:none;text-decoration:none;width:auto;height:${h}px;max-height:${h}px;max-width:${w}px;" />`;
}
