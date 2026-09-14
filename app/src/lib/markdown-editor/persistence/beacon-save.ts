import { CRM_API_BASE } from "@/lib/crm/api-base";

/**
 * Best-effort body PATCH on tab close (fetch keepalive). `path` is the
 * editor's persistence path — `<campaignId>/broadcasts/<broadcastId>` for
 * CRM broadcast content — appended verbatim after `/crm/campaigns/`.
 */
export function tryCampaignBeaconSave(path: string, bodyMarkdown: string): boolean {
  if (typeof fetch === "undefined") return false;
  try {
    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    void fetch(`${CRM_API_BASE}/crm/campaigns/${encodedPath}`, {
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
