import { CRM_API_BASE } from "@/lib/crm/api-base";

/**
 * Best-effort body PATCH on tab close (fetch keepalive). `path` is the
 * broadcast id for CRM broadcast content.
 */
export function tryCampaignBeaconSave(path: string, bodyMarkdown: string): boolean {
  if (typeof fetch === "undefined") return false;
  try {
    const broadcastId = path.split("/").filter(Boolean).pop() ?? path;
    void fetch(`${CRM_API_BASE}/crm/broadcasts/${encodeURIComponent(broadcastId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bodyMarkdown }),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}
