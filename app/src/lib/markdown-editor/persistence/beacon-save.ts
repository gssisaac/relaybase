import { CRM_API_BASE } from "@/lib/crm/api-base";

/** Best-effort body PATCH on tab close (fetch keepalive). */
export function tryCampaignBeaconSave(campaignId: string, bodyMarkdown: string): boolean {
  if (typeof fetch === "undefined") return false;
  try {
    void fetch(`${CRM_API_BASE}/crm/campaigns/${encodeURIComponent(campaignId)}`, {
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
