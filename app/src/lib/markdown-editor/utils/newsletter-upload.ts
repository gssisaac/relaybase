import { studioApi } from "@/lib/studio/api";

export type CrmContentAssetOwner = "newsletter" | "trigger" | "message";

/** Upload optimized image bytes; returns a public URL for BlockNote `resolveFileUrl`. */
export async function uploadNewsletterAsset(
  newsletterId: string,
  filename: string,
  mimeType: string,
  contentBase64: string,
  owner: CrmContentAssetOwner = "newsletter",
): Promise<string> {
  const payload = { filename, mimeType, contentBase64 };
  const res =
    owner === "trigger"
      ? await studioApi.uploadTriggerAsset(newsletterId, payload)
      : owner === "message"
        ? await studioApi.uploadMessageAsset(newsletterId, payload)
        : await studioApi.uploadNewsletterAsset(newsletterId, payload);
  return res.url;
}
