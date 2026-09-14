import { blobToBase64, optimizeImageToWebp } from "./image-optimize";
import {
  DEFAULT_IMAGE_OPTIMIZATION_SETTINGS,
  type ImageOptimizationSettings,
} from "./image-settings";
import {
  classifyPageFile,
  extensionFromFilename,
  humanizeAssetFilename,
  pageAssetFilename,
  pageAssetMarkdownUrl,
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

  let blob: Blob = opts.file;
  let ext = extensionFromFilename(opts.file.name);

  const isGif = (opts.file.type || "").includes("gif") || ext === "gif";
  if (isGif) {
    ext = "gif";
  } else {
    const optimized = await optimizeImageToWebp(opts.file, settings);
    blob = optimized.file;
    ext = optimized.mimeType === "image/gif" ? "gif" : "webp";
  }

  const filename = pageAssetFilename(opts.file.name, ext);
  const mimeType = ext === "gif" ? "image/gif" : "image/webp";
  const publicUrl = await uploadCampaignAsset(
    opts.campaignId,
    filename,
    mimeType,
    await blobToBase64(blob),
  );

  return {
    markdownUrl: normalizeCampaignAssetUrl(publicUrl),
    name: humanizeAssetFilename(filename, "image"),
    kind: "image",
    ext,
  };
}

export function markdownForIngestedFile(ingested: IngestedPageFile): string {
  if (ingested.kind === "image") {
    return `![${ingested.name}](${ingested.markdownUrl})`;
  }
  return `[${ingested.name}](${ingested.markdownUrl})`;
}
