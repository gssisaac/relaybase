import { isCrmApiRequest } from "./crm-origin";

const CRM_UI_GET_PATHS = new Set([
  "/crm",
  "/crm/audience",
  "/crm/broadcasts",
  "/crm/broadcasts/sent",
  "/crm/broadcasts/in-progress",
]);

/** True when this request should be forwarded to hq/crm (relaybase.email edge → upstream). */
export function shouldProxyRequestToCrm(pathname: string, method: string, headers: Headers): boolean {
  if (!pathname.startsWith("/crm/")) return false;

  if (pathname.startsWith("/crm/unsubscribe")) return true;
  if (pathname.startsWith("/crm/t/")) return true;
  if (pathname.startsWith("/crm/webhooks")) return true;
  if (pathname.startsWith("/crm/audience-groups")) return true;
  if (pathname.startsWith("/crm/templates")) return true;
  if (pathname === "/crm/account-link") return true;
  if (pathname.startsWith("/crm/compliance-identities")) return true;
  if (pathname.startsWith("/crm/brand/")) return true;
  if (pathname.startsWith("/crm/assets/")) return true;

  if (!pathname.startsWith("/crm/broadcasts")) return false;

  if (method !== "GET") return true;
  if (isCrmApiRequest(headers)) return true;
  if (pathname === "/crm/broadcasts/sent-stats") return true;
  if (CRM_UI_GET_PATHS.has(pathname)) return false;
  return true;
}
