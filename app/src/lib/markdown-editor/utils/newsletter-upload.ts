import { scaleApi } from "@/lib/scale/api";

export type CrmContentAssetOwner = "newsletter" | "trigger" | "template";

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
      ? await scaleApi.uploadTriggerAsset(newsletterId, payload)
      : owner === "template"
        ? await scaleApi.uploadMessageTemplateAsset(newsletterId, payload)
        : await scaleApi.uploadNewsletterAsset(newsletterId, payload);
  return res.url;
}
