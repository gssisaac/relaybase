import { SCALE_PUBLIC_BASE_URL } from "../shared/scale-url";

export const DEFAULT_BRAND_LOGO_FILENAME = "relaybase-icon.png";

export function defaultBrandLogoUrl(scaleBaseUrl: string = SCALE_PUBLIC_BASE_URL): string {
  return `${scaleBaseUrl.replace(/\/$/, "")}/scale/brand/${DEFAULT_BRAND_LOGO_FILENAME}`;
}

/** Small logo for template footers (and compact header slots). */
export const FOOTER_LOGO_MAX_WIDTH_PX = 80;
export const FOOTER_LOGO_HEIGHT_PX = 24;

export function footerBrandLogoImageHtml(src: string): string {
  const w = FOOTER_LOGO_MAX_WIDTH_PX;
  const h = FOOTER_LOGO_HEIGHT_PX;
  return `<img src="${src}" alt="" width="${w}" height="${h}" style="display:block;border:0;outline:none;text-decoration:none;width:auto;height:${h}px;max-height:${h}px;max-width:${w}px;" />`;
}
