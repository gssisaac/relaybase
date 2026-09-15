/** Links in outbound mail + content preview footer (not the customer Worker). */
export const CRM_PUBLIC_LINK_ORIGIN =
  process.env.NEXT_PUBLIC_CRM_PUBLIC_BASE?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_CRM_API_BASE?.replace(/\/$/, "") ??
  "https://relaybase.email";

/** CRM dashboard fetches identify as API (not the /crm/* UI routes). */
export const CRM_API_REQUEST_HEADER = "x-relaybase-crm-api";

export function isCrmApiRequest(headers: Headers): boolean {
  return headers.get(CRM_API_REQUEST_HEADER) === "1";
}

const LOCAL_DEV_APP =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:32830";

/**
 * Origin for browser/server CRM API calls (`crmFetch`, editor asset uploads).
 * Local dev uses the Next app origin so middleware can proxy to hq/crm on :32831.
 * Production defaults to relaybase.email unless NEXT_PUBLIC_CRM_API_BASE is set.
 */
export function getCrmApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_CRM_API_BASE?.replace(/\/$/, "");
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return origin;
    }
  }

  if (process.env.NODE_ENV === "development") {
    return LOCAL_DEV_APP;
  }

  return "https://relaybase.email";
}
