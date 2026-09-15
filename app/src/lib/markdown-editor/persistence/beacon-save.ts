import { getCrmApiBase } from "@/lib/crm/api-base";
import { CRM_API_REQUEST_HEADER } from "@/lib/crm/crm-origin";

/**
 * Best-effort body PATCH on tab close (fetch keepalive). `path` is the
 * broadcast id for CRM broadcast content.
 */
export function tryCampaignBeaconSave(path: string, bodyMarkdown: string): boolean {
  if (typeof fetch === "undefined") return false;
  try {
    const broadcastId = path.split("/").filter(Boolean).pop() ?? path;
    void fetch(`${getCrmApiBase()}/crm/broadcasts/${encodeURIComponent(broadcastId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [CRM_API_REQUEST_HEADER]: "1",
      },
      body: JSON.stringify({ bodyMarkdown }),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}
