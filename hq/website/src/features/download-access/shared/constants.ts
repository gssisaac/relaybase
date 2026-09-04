/** Switch to `"email"` to route Mac CTAs back through /get-started signup. */
export const DOWNLOAD_ACCESS_MODE = "direct" as "direct" | "email";

export const CLIENT_ID_STORAGE_KEY = "rb_download_id";

export const CLIENT_ID_COOKIE_KEY = "rb_download_id";

/** One year — matches typical analytics cookie lifetime. */
export const CLIENT_ID_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export const DEVICE_EMAIL_PREFIX = "device:";

export const DIRECT_DOWNLOAD_API_PATH = "/api/beta/download";

export const PRODUCTION_SITE_ORIGIN = "https://relaybase.xyz";

export const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function isRelaybaseSiteHost(hostname: string): boolean {
  return hostname === "relaybase.xyz" || hostname.endsWith(".relaybase.xyz");
}
