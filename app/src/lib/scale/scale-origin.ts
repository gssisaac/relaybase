/** Links in outbound mail + content preview footer (not the customer Worker). */
export const SCALE_PUBLIC_LINK_ORIGIN =
  process.env.NEXT_PUBLIC_SCALE_PUBLIC_BASE?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_SCALE_API_BASE?.replace(/\/$/, "") ??
  "https://relaybase.email";

/** Scale dashboard fetches identify as API (not the /scale/* UI routes). */
export const SCALE_API_REQUEST_HEADER = "x-relaybase-scale-api";

export function isScaleApiRequest(headers: Headers): boolean {
  return headers.get(SCALE_API_REQUEST_HEADER) === "1";
}

const LOCAL_DEV_APP =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:32830";

/**
 * Origin for browser/server Scale API calls (`scaleFetch`, editor asset uploads).
 * Local dev uses the Next app origin so middleware can proxy to hq/scale on :32831.
 * Production defaults to relaybase.email unless NEXT_PUBLIC_SCALE_API_BASE is set.
 */
export function getScaleApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_SCALE_API_BASE?.replace(/\/$/, "");
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
