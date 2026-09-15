import { getScaleApiBase } from "@/lib/scale/api-base";
import { SCALE_API_REQUEST_HEADER } from "@/lib/scale/scale-origin";

/**
 * Best-effort body PATCH on tab close (fetch keepalive). `path` is the
 * broadcast id for Scale broadcast content.
 */
export function tryCampaignBeaconSave(path: string, bodyMarkdown: string): boolean {
  if (typeof fetch === "undefined") return false;
  try {
    const broadcastId = path.split("/").filter(Boolean).pop() ?? path;
    void fetch(`${getScaleApiBase()}/scale/broadcasts/${encodeURIComponent(broadcastId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [SCALE_API_REQUEST_HEADER]: "1",
      },
      body: JSON.stringify({ bodyMarkdown }),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}
