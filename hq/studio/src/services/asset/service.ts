import { FALLBACK_BRAND_LOGO_PNG } from "@services/asset/fallback-brand-logo";
import { newsletterAssetKey } from "@services/asset/key";
import { resolveStudioAssetUrl, studioAssetFolderStem } from "@services/asset/resolve-url";

export class AssetService {
  private static instance: AssetService;

  static getInstance(): AssetService {
    if (!AssetService.instance) {
      AssetService.instance = new AssetService();
    }
    return AssetService.instance;
  }

  newsletterAssetKey(broadcastId: string, filename: string) {
    return newsletterAssetKey(broadcastId, filename);
  }

  assetFolderStem(ownerId: string) {
    return studioAssetFolderStem(ownerId);
  }

  resolveStudioAssetUrl(
    ownerId: string,
    studioBaseUrl: string,
    href: string,
  ) {
    return resolveStudioAssetUrl(ownerId, studioBaseUrl, href);
  }

  fallbackBrandLogoPng() {
    return FALLBACK_BRAND_LOGO_PNG;
  }
}

export const assetService = AssetService.getInstance();
