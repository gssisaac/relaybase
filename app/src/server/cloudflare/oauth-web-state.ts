/**
 * Web install OAuth round-trips `code` through console.relaybase.xyz because
 * that is the only redirect URI registered on the Cloudflare OAuth client.
 * State carries the originating web origin so the console can bounce back
 * here without an open redirect. Keep in sync with
 * `hq/console/src/lib/oauth-web-state.ts`.
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

export function encodeWebOAuthState(payload: WebOAuthStatePayload): string {
  return (
    WEB_OAUTH_STATE_PREFIX +
    Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  );
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
