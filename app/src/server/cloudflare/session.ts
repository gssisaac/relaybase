// Encrypted, HTTP-only cookie session for the web install flow. Replaces the
// desktop's in-memory CfOAuthSession + OS keyring — Next.js Route Handlers
// are stateless, so the CF OAuth tokens travel in a sealed cookie instead.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const OAUTH_COOKIE = "rb_cf_oauth";
const PKCE_COOKIE = "rb_cf_pkce";

export type CfOAuthSession = {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  clientId: string;
  expiresAt: number; // unix seconds
};

export type PkceState = {
  state: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
};

function sessionKey(): Buffer {
  const secret =
    process.env.RELAYBASE_SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "relaybase-dev-secret-do-not-use-in-production";
  return createHash("sha256").update(secret).digest();
}

function seal(payload: unknown): string {
  const key = sessionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function unseal<T>(sealed: string | undefined | null): T | null {
  if (!sealed) return null;
  try {
    const buf = Buffer.from(sealed, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function sealOAuthSession(session: CfOAuthSession): string {
  return seal(session);
}

export function readOAuthSessionCookie(sealed: string | undefined | null): CfOAuthSession | null {
  return unseal<CfOAuthSession>(sealed);
}

export function sealPkceState(pkce: PkceState): string {
  return seal(pkce);
}

export function readPkceCookie(sealed: string | undefined | null): PkceState | null {
  return unseal<PkceState>(sealed);
}

export const COOKIE_NAMES = { oauth: OAUTH_COOKIE, pkce: PKCE_COOKIE } as const;

export function accessTokenIsFresh(session: CfOAuthSession): boolean {
  if (!session.accessToken.trim()) return false;
  const nowSecs = Math.floor(Date.now() / 1000);
  return session.expiresAt - nowSecs >= 60;
}

/** Refresh the CF OAuth access token when it is expiring within 60s. */
export async function refreshIfNeeded(session: CfOAuthSession): Promise<CfOAuthSession> {
  if (accessTokenIsFresh(session)) return session;
  if (!session.refreshToken.trim()) {
    throw new Error("CLOUDFLARE_AUTH_EXPIRED: Authorize with Cloudflare again");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: session.clientId,
  });
  const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    let oauthError: string | undefined;
    try {
      oauthError = JSON.parse(text)?.error;
    } catch {
      /* ignore */
    }
    if (oauthError === "invalid_grant") {
      throw new Error("CLOUDFLARE_AUTH_EXPIRED: Authorize with Cloudflare again");
    }
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${text}`);
  }
  const tokens = JSON.parse(text);
  const accessToken = tokens.access_token as string;
  const expiresIn = Number(tokens.expires_in ?? 3600);
  const nextRefresh = (tokens.refresh_token as string | undefined) ?? session.refreshToken;
  return {
    ...session,
    accessToken,
    refreshToken: nextRefresh,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };
}
