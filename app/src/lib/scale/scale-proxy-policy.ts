import { isScaleApiRequest } from "./scale-origin";

const SCALE_UI_GET_PATHS = new Set([
  "/scale",
  "/scale/overview",
  "/scale/audience",
  "/scale/campaigns",
  "/scale/campaigns/sent",
  "/scale/campaigns/in-progress",
  "/scale/triggers",
  "/scale/triggers/trigger-stats",
  "/scale/triggers/edit",
  "/scale/templates",
  "/scale/layouts",
  "/scale/schedule",
]);

const TRIGGER_UI_TAB_SEGMENTS = new Set([
  "preview",
  "trigger",
  "stats",
  "settings",
  "edit",
  "content",
]);

/** GET UI routes under `/scale/triggers/{id}/{tab}` — not the JSON API. */
function isTriggerUiGetPath(pathname: string): boolean {
  if (SCALE_UI_GET_PATHS.has(pathname)) return true;
  const match = pathname.match(/^\/scale\/triggers\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return false;
  const id = match[1] ?? "";
  if (!id || id === "edit") return false;
  const tab = match[2];
  if (!tab) return true;
  return TRIGGER_UI_TAB_SEGMENTS.has(tab);
}

/** True when this request should be forwarded to hq/scale (relaybase.email edge → upstream). */
export function shouldProxyRequestToScale(pathname: string, method: string, headers: Headers): boolean {
  if (!pathname.startsWith("/scale/")) return false;

  if (pathname.startsWith("/scale/unsubscribe")) return true;
  if (pathname.startsWith("/scale/t/")) return true;
  if (pathname.startsWith("/scale/webhooks")) return true;
  if (pathname.startsWith("/scale/audience-groups")) return true;
  if (pathname === "/scale/account-link") return true;
  if (pathname.startsWith("/scale/compliance-identities")) return true;
  if (pathname.startsWith("/scale/brand/")) return true;
  if (pathname.startsWith("/scale/assets/")) return true;

  if (pathname === "/scale/overview") {
    if (method !== "GET") return true;
    if (isScaleApiRequest(headers)) return true;
    return false;
  }

  if (pathname.startsWith("/scale/templates")) {
    if (method !== "GET" && method !== "HEAD") return true;
    if (isScaleApiRequest(headers)) return true;
    if (pathname === "/scale/templates") return false;
    return true;
  }

  if (pathname.startsWith("/scale/layouts")) {
    if (method !== "GET" && method !== "HEAD") return true;
    if (isScaleApiRequest(headers)) return true;
    if (pathname === "/scale/layouts") return false;
    return true;
  }

  if (pathname.startsWith("/scale/triggers")) {
    if (pathname === "/scale/triggers/stats") {
      if (method !== "GET" && method !== "HEAD") return true;
      if (isScaleApiRequest(headers)) return true;
      return false;
    }
    if (method !== "GET" && method !== "HEAD") return true;
    if (isScaleApiRequest(headers)) return true;
    if (isTriggerUiGetPath(pathname)) return false;
    return true;
  }

  if (!pathname.startsWith("/scale/campaigns")) return false;

  if (method !== "GET") return true;
  if (isScaleApiRequest(headers)) return true;
  if (pathname === "/scale/campaigns/sent-stats") return true;
  if (SCALE_UI_GET_PATHS.has(pathname)) return false;
  return true;
}
