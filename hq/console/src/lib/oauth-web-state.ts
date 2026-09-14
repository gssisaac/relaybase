/**
 * Web install OAuth round-trips `code` through this console callback because
 * it is the only redirect URI registered on the Cloudflare OAuth client.
 * Keep in sync with `app/src/server/cloudflare/oauth-web-state.ts`.
 */
export const WEB_OAUTH_STATE_PREFIX = "rbweb.";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://relaybase.email",
  "https://www.relaybase.email",
  "http://localhost:32830",
  "http://127.0.0.1:32830",
] as const;

export type WebOAuthStatePayload = {
  origin: string;
  nonce: string;
};

export function isAllowedWebOAuthReturnOrigin(origin: string): boolean {
  return (DEFAULT_ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

export function parseWebOAuthState(state: string): WebOAuthStatePayload | null {
  if (!state.startsWith(WEB_OAUTH_STATE_PREFIX)) return null;
  try {
    const json = Buffer.from(state.slice(WEB_OAUTH_STATE_PREFIX.length), "base64url").toString(
      "utf8",
    );
    const parsed = JSON.parse(json) as Partial<WebOAuthStatePayload>;
    if (typeof parsed.origin !== "string" || typeof parsed.nonce !== "string") return null;
    if (!parsed.nonce.trim() || !isAllowedWebOAuthReturnOrigin(parsed.origin)) return null;
    return { origin: parsed.origin, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

/** Forward Cloudflare's OAuth query string to the web app's PKCE callback. */
export function webOAuthCallbackUrl(origin: string, source: URL): URL {
  const dest = new URL("/api/oauth/callback", origin);
  for (const key of ["code", "state", "error", "error_description"] as const) {
    const value = source.searchParams.get(key);
    if (value) dest.searchParams.set(key, value);
  }
  return dest;
}
