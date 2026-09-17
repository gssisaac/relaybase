/** Links in outbound mail + content preview footer (not the customer Worker). */
export const STUDIO_PUBLIC_LINK_ORIGIN =
  process.env.NEXT_PUBLIC_STUDIO_PUBLIC_BASE?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_STUDIO_API_BASE?.replace(/\/$/, "") ??
  "https://relaybase.email";

/** Studio dashboard fetches identify as API (not the /studio/* UI routes). */
export const STUDIO_API_REQUEST_HEADER = "x-relaybase-studio-api";

export function isStudioApiRequest(headers: Headers): boolean {
  return headers.get(STUDIO_API_REQUEST_HEADER) === "1";
}

const LOCAL_DEV_APP =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:32830";

/**
 * Origin for browser/server Studio API calls (`studioFetch`, editor asset uploads).
 * Local dev uses the Next app origin so middleware can proxy to hq/studio on :32832.
 * Production defaults to relaybase.email unless NEXT_PUBLIC_STUDIO_API_BASE is set.
 */
function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getStudioApiBase(): string {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (isLocalDevHost(hostname)) {
      return origin;
    }
  }

  if (process.env.NODE_ENV === "development") {
    return LOCAL_DEV_APP;
  }

  const explicit = process.env.NEXT_PUBLIC_STUDIO_API_BASE?.replace(/\/$/, "");
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "https://relaybase.email";
}
