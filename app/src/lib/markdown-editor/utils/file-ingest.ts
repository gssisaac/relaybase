import { blobToBase64, optimizeForEmail } from "./image-optimize";
import {
  DEFAULT_IMAGE_OPTIMIZATION_SETTINGS,
  type ImageOptimizationSettings,
} from "./image-settings";
import {
  classifyPageFile,
  humanizeAssetFilename,
  pageAssetFilename,
  type PageAssetKind,
} from "./assets";
import { normalizeCampaignAssetUrl } from "./asset-url";
import { uploadCampaignAsset } from "./campaign-upload";

export type IngestedPageFile = {
  markdownUrl: string;
  name: string;
  kind: PageAssetKind;
  ext: string;
};

export async function ingestCampaignFile(opts: {
  file: File;
  campaignId: string;
  settings?: ImageOptimizationSettings;
}): Promise<IngestedPageFile> {
  const settings = opts.settings ?? DEFAULT_IMAGE_OPTIMIZATION_SETTINGS;
  const kind = classifyPageFile(opts.file);
  if (kind !== "image") {
    throw new Error("Only images are supported in campaign editor (v0.2)");
  }

  const optimized = await optimizeForEmail(opts.file, settings);
  const filename = pageAssetFilename(opts.file.name, optimized.ext);
  const publicUrl = await uploadCampaignAsset(
    opts.campaignId,
    filename,
    optimized.mimeType,
    await blobToBase64(optimized.file),
  );

  return {
    markdownUrl: normalizeCampaignAssetUrl(publicUrl),
    name: humanizeAssetFilename(filename, "image"),
    kind: "image",
    ext: optimized.ext,
  };
}

export function markdownForIngestedFile(ingested: IngestedPageFile): string {
  if (ingested.kind === "image") {
    return `![${ingested.name}](${ingested.markdownUrl})`;
  }
  return `[${ingested.name}](${ingested.markdownUrl})`;
}
