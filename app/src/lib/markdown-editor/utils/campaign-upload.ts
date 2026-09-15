import { scaleApi } from "@/lib/scale/api";

export type CrmContentAssetOwner = "broadcast" | "automation";

/** Upload optimized image bytes; returns a public URL for BlockNote `resolveFileUrl`. */
export async function uploadCampaignAsset(
  campaignId: string,
  filename: string,
  mimeType: string,
  contentBase64: string,
  owner: CrmContentAssetOwner = "broadcast",
): Promise<string> {
  const payload = { filename, mimeType, contentBase64 };
  const res =
    owner === "automation"
      ? await scaleApi.uploadAutomationAsset(campaignId, payload)
      : await scaleApi.uploadBroadcastAsset(campaignId, payload);
  return res.url;
}
