import { isDesktopRuntime } from "./invoke";

export const PENDING_SERVER_TOKEN_PUSH_KEY = "relaybase.pending-push-server-token";
export const PENDING_RECOVER_AFTER_OAUTH_KEY = "relaybase.pending-recover-after-oauth";

/** Strip `cf_oauth=complete` after a web OAuth redirect and run `onComplete` once. */
export function consumeWebCfOAuthCompleteParam(): boolean {
  if (typeof window === "undefined" || isDesktopRuntime()) return false;
  const u = new URL(window.location.href);
  if (u.searchParams.get("cf_oauth") !== "complete") return false;
  u.searchParams.delete("cf_oauth");
  const next = `${u.pathname}${u.search}${u.hash}`;
  window.history.replaceState({}, "", next);
  return true;
}

export async function fetchWebCfOAuthSessionPresent(): Promise<boolean> {
  if (isDesktopRuntime()) return false;
  try {
    const res = await fetch("/api/oauth/session", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { present?: boolean };
    return Boolean(data.present);
  } catch {
    return false;
  }
}
