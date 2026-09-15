import { getScaleApiBase } from "@/lib/scale/api-base";
import { SCALE_API_REQUEST_HEADER } from "@/lib/scale/scale-origin";

/**
 * Best-effort body PATCH on tab close (fetch keepalive). `path` is
 * `campaigns/:id`, `templates/:id`, or `triggers/:id` (or a bare id → campaign).
 */
export function tryCampaignBeaconSave(path: string, bodyMarkdown: string): boolean {
  if (typeof fetch === "undefined") return false;
  try {
    const segments = path.split("/").filter(Boolean);
    const kind =
      segments[0] === "templates" || segments[0] === "triggers" || segments[0] === "campaigns"
        ? segments[0]
        : "campaigns";
    const id = segments.length > 1 ? segments[segments.length - 1]! : path;
    void fetch(`${getScaleApiBase()}/scale/${kind}/${encodeURIComponent(id)}`, {
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
