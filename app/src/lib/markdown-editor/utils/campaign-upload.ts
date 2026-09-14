import { crmApi } from "@/lib/crm/api";

/** Upload optimized image bytes; returns a public URL for BlockNote `resolveFileUrl`. */
export async function uploadCampaignAsset(
  campaignId: string,
  filename: string,
  mimeType: string,
  contentBase64: string,
): Promise<string> {
  const res = await crmApi.uploadCampaignAsset(campaignId, {
    filename,
    mimeType,
    contentBase64,
  });
  return res.url;
}
