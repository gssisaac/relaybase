import { STUDIO_PUBLIC_BASE_URL } from "@lib/shared/studio-url";
import {
  DEFAULT_BRAND_LOGO_FILENAME,
  DEFAULT_BRAND_LOGO_PATH,
} from "@lib/templates/brand-logo-path";

export { DEFAULT_BRAND_LOGO_FILENAME, DEFAULT_BRAND_LOGO_PATH };

export function defaultBrandLogoUrl(studioBaseUrl: string = STUDIO_PUBLIC_BASE_URL): string {
  return `${studioBaseUrl.replace(/\/$/, "")}${DEFAULT_BRAND_LOGO_PATH}`;
}

/** Small logo for template footers (and compact header slots). */
export const FOOTER_LOGO_MAX_WIDTH_PX = 80;
export const FOOTER_LOGO_HEIGHT_PX = 24;

export function footerBrandLogoImageHtml(src: string): string {
  const w = FOOTER_LOGO_MAX_WIDTH_PX;
  const h = FOOTER_LOGO_HEIGHT_PX;
  return `<img src="${src}" alt="" width="${w}" height="${h}" style="display:block;border:0;outline:none;text-decoration:none;width:auto;height:${h}px;max-height:${h}px;max-width:${w}px;" />`;
}
