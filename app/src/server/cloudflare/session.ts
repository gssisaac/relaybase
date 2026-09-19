// Encrypted, HTTP-only cookie session for the web install flow. Replaces the
// desktop's in-memory CfOAuthSession + OS keyring — Next.js Route Handlers
// are stateless, so the CF OAuth tokens travel in a sealed cookie instead.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import type { NextResponse } from "next/server";

const OAUTH_COOKIE = "rb_cf_oauth";
const PKCE_COOKIE = "rb_cf_pkce";

/** Refresh-token rotation window — Cloudflare access tokens live ~1h. */
const OAUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Cookie options for the sealed OAuth session cookie. `secure` is only set
 * in production so dev on `http://localhost` actually keeps the cookie —
 * browsers silently drop `Secure` cookies over plain HTTP, which was
 * forcing a re-auth on every dev reload.
 */
export function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}

/** Cookie options for the short-lived PKCE verifier cookie. */
export function pkceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/oauth",
    maxAge: 600,
  };
}

/**
 * Re-seal and re-set the OAuth session cookie on a response when the
 * in-flight session was refreshed. No-op when `refreshedCookie` is null
 * (the access token was still fresh and no rotation happened).
 *
 * Callers MUST call this on every response from a route that uses
 * `requireCfSession`. Cloudflare rotates the refresh_token on every
 * refresh, so failing to write the new cookie leaves the browser holding
 * a now-invalid refresh_token — the next request 401s and forces a full
 * browser re-auth.
 */
export function applyRefreshedCookie(
  response: NextResponse,
  refreshedCookie: string | null,
): NextResponse {
  if (refreshedCookie) {
    response.cookies.set(COOKIE_NAMES.oauth, refreshedCookie, oauthCookieOptions());
  }
  return response;
}

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
  /** Relative in-app path after OAuth (e.g. /settings/cloudflare). */
  returnTo?: string;
  purpose?: "install" | "recover";
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

const SIGNUP_STAGING_COOKIE = "rb_signup_staging";

export type SignupInstallStaging = {
  workerUrl: string;
  accountId: string;
  authPepper: string;
  expiresAt: number;
};

export function sealSignupStaging(staging: Omit<SignupInstallStaging, "expiresAt">): string {
  return seal({
    ...staging,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
}

export function readSignupStagingCookie(sealed: string | undefined | null): SignupInstallStaging | null {
  const parsed = unseal<SignupInstallStaging>(sealed);
  if (!parsed?.workerUrl || !parsed.accountId || !parsed.authPepper) return null;
  if (parsed.expiresAt <= Date.now()) return null;
  return parsed;
}

export function signupStagingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: 900,
  };
}

export const COOKIE_NAMES = {
  oauth: OAUTH_COOKIE,
  pkce: PKCE_COOKIE,
  signupStaging: SIGNUP_STAGING_COOKIE,
} as const;

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

// ─── Single-flight refresh ───────────────────────────────────────────────
//
// Next.js Route Handlers are stateless, but a single dashboard view often
// fires several `/api/...` requests in parallel (oauth/session, install/probe,
// …). If the access token is expiring, every concurrent request would
// independently POST the same refresh_token to Cloudflare. Cloudflare
// rotates refresh_tokens on every exchange and invalidates the old one, so
// the second request arrives with an already-used token and Cloudflare
// returns `invalid_grant` for it — which surfaces to the user as a forced
// re-auth even though the first refresh succeeded.
//
// We de-duplicate by the refresh_token string: all callers waiting on the
// same refresh share one promise. The cache is keyed by the *input*
// refresh_token (the value the callers currently hold), so a rotated
// session from a previous refresh does not collide with a new one.
const inflightRefreshByToken = new Map<string, Promise<CfOAuthSession>>();

/**
 * Refresh the session if needed, de-duplicating concurrent refreshes that
 * share the same refresh_token. Always returns a session with a fresh
 * access token (or throws `CLOUDFLARE_AUTH_EXPIRED`).
 */
export async function refreshIfNeededSingleFlight(
  session: CfOAuthSession,
): Promise<CfOAuthSession> {
  if (accessTokenIsFresh(session)) return session;
  const key = session.refreshToken.trim();
  if (!key) {
    throw new Error("CLOUDFLARE_AUTH_EXPIRED: Authorize with Cloudflare again");
  }
  const existing = inflightRefreshByToken.get(key);
  if (existing) return existing;
  const promise = refreshIfNeeded(session).finally(() => {
    // Drop the cache entry once the refresh settles so a later, separate
    // rotation (with a different refresh_token) is not blocked by a stale
    // promise. Cloudflare rotates the refresh_token, so the key naturally
    // changes after a successful refresh.
    inflightRefreshByToken.delete(key);
  });
  inflightRefreshByToken.set(key, promise);
  return promise;
}
