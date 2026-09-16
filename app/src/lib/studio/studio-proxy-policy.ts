import { isStudioApiRequest } from "./studio-origin";

const STUDIO_UI_GET_PATHS = new Set([
  "/studio",
  "/studio/overview",
  "/studio/dashboard",
  "/studio/analytics",
  "/studio/subscribers",
  "/studio/newsletters",
  "/studio/newsletters/sent",
  "/studio/newsletters/in-progress",
  "/studio/triggers",
  "/studio/triggers/trigger-stats",
  "/studio/triggers/edit",
  "/studio/templates",
  "/studio/templates/edit",
  "/studio/layouts",
  "/studio/schedule",
]);

const TRIGGER_UI_TAB_SEGMENTS = new Set([
  "config",
  "preview",
  "trigger",
  "stats",
  "settings",
  "edit",
  "content",
]);

/** GET UI routes under `/studio/triggers/{id}/{tab}` — not the JSON API. */
function isTriggerUiGetPath(pathname: string): boolean {
  if (STUDIO_UI_GET_PATHS.has(pathname)) return true;
  const match = pathname.match(/^\/studio\/triggers\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return false;
  const id = match[1] ?? "";
  if (!id || id === "edit") return false;
  const tab = match[2];
  if (!tab) return true;
  return TRIGGER_UI_TAB_SEGMENTS.has(tab);
}

/** True when this request should be forwarded to hq/studio (relaybase.email edge → upstream). */
export function shouldProxyRequestToStudio(pathname: string, method: string, headers: Headers): boolean {
  if (!pathname.startsWith("/studio/")) return false;

  if (pathname.startsWith("/studio/unsubscribe")) return true;
  if (pathname.startsWith("/studio/t/")) return true;
  if (pathname.startsWith("/studio/webhooks")) return true;
  if (pathname.startsWith("/studio/audience-groups")) return true;
  if (pathname === "/studio/account-link") return true;
  if (pathname.startsWith("/studio/compliance-identities")) return true;
  if (pathname.startsWith("/studio/brand/")) return true;
  if (pathname.startsWith("/studio/assets/")) return true;

  if (pathname === "/studio/overview") {
    if (method !== "GET") return true;
    if (isStudioApiRequest(headers)) return true;
    return false;
  }

  if (pathname.startsWith("/studio/templates")) {
    if (method !== "GET" && method !== "HEAD") return true;
    if (isStudioApiRequest(headers)) return true;
    if (STUDIO_UI_GET_PATHS.has(pathname)) return false;
    return true;
  }

  if (pathname.startsWith("/studio/layouts")) {
    if (method !== "GET" && method !== "HEAD") return true;
    if (isStudioApiRequest(headers)) return true;
    if (pathname === "/studio/layouts") return false;
    return true;
  }

  if (pathname.startsWith("/studio/triggers")) {
    if (pathname === "/studio/triggers/stats") {
      if (method !== "GET" && method !== "HEAD") return true;
      if (isStudioApiRequest(headers)) return true;
      return false;
    }
    if (method !== "GET" && method !== "HEAD") return true;
    if (isStudioApiRequest(headers)) return true;
    if (isTriggerUiGetPath(pathname)) return false;
    return true;
  }

  if (!pathname.startsWith("/studio/newsletters")) return false;

  if (method !== "GET") return true;
  if (isStudioApiRequest(headers)) return true;
  if (pathname === "/studio/newsletters/sent-stats") return true;
  if (STUDIO_UI_GET_PATHS.has(pathname)) return false;
  return true;
}
