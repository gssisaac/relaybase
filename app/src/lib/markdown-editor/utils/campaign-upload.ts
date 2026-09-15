import { scaleApi } from "@/lib/scale/api";

export type CrmContentAssetOwner = "campaign" | "trigger" | "template";

/** Upload optimized image bytes; returns a public URL for BlockNote `resolveFileUrl`. */
export async function uploadCampaignAsset(
  campaignId: string,
  filename: string,
  mimeType: string,
  contentBase64: string,
  owner: CrmContentAssetOwner = "campaign",
): Promise<string> {
  const payload = { filename, mimeType, contentBase64 };
  const res =
    owner === "trigger"
      ? await scaleApi.uploadTriggerAsset(campaignId, payload)
      : owner === "template"
        ? await scaleApi.uploadMessageTemplateAsset(campaignId, payload)
        : await scaleApi.uploadCampaignAsset(campaignId, payload);
  return res.url;
}
