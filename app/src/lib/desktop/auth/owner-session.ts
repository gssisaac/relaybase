"use client";

import { resolveEmailApiBase } from "@/lib/desktop/api";

/**
 * Owner session held in **JS process memory only**.
 *
 * The passtoken, access token, and refresh token are NEVER written to disk,
 * cookies, localStorage, or sessionStorage. The user keeps the one-time
 * passtoken download; the app holds the session in memory for the lifetime
 * of the process. On the desktop, refresh lives in the OS keyring and daily
 * unlock is Touch ID / Windows Hello (`desktop/biometry` + Rust `owner_unlock`).
 * This module is the browser `pnpm next` in-memory session; the Tauri
 * webview uses Rust `worker_request` so JS never sees tokens.
 */

export type OwnerSession = {
  accessToken: string;
  refreshToken: string;
  /** Unix ms when the access token expires. */
  accessExpiresAt: number;
  /** Seconds until access expiry, as returned by /console/login. */
  expiresIn: number;
};

let session: OwnerSession | null = null;
let refreshPromise: Promise<OwnerSession | null> | null = null;

export function getOwnerSession(): OwnerSession | null {
  return session;
}

export function hasOwnerSession(): boolean {
  return Boolean(session && session.accessToken);
}

export function setOwnerSession(next: OwnerSession): void {
  session = {
    ...next,
    accessExpiresAt:
      next.accessExpiresAt ||
      Date.now() + Math.max(5, next.expiresIn) * 1000,
  };
  refreshPromise = null;
}

export function clearOwnerSession(): void {
  session = null;
  refreshPromise = null;
}

/** Current access token, or null when not logged in. */
export function getAccessToken(): string | null {
  return session?.accessToken ?? null;
}

/** Access token, refreshing when it expires within 30s. */
export async function ensureAccessToken(): Promise<string | null> {
  if (!session?.accessToken) return null;
  if (session.accessExpiresAt - Date.now() > 30_000) {
    return session.accessToken;
  }
  const next = await ownerRefresh();
  return next?.accessToken ?? null;
}

function workerBase(): string {
  return resolveEmailApiBase();
}

async function postJson(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const base = workerBase();
  if (!base) throw new Error("Worker is not connected.");
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

/**
 * POST /console/login — exchange username + passtoken for an access + refresh
 * pair. The passtoken is consumed here and not retained.
 */
export async function ownerLogin(input: {
  username: string;
  passtoken: string;
  label?: string;
}): Promise<OwnerSession> {
  const res = await postJson("/console/login", {
    username: input.username.trim(),
    passtoken: input.passtoken.trim(),
    label: input.label ?? "desktop",
  });
  const data = await readJson<{
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }>(res);
  if (!res.ok || !data.accessToken || !data.refreshToken) {
    throw new Error(data.error || `Login failed (${res.status})`);
  }
  const next: OwnerSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn ?? 600,
    accessExpiresAt: Date.now() + Math.max(5, data.expiresIn ?? 600) * 1000,
  };
  setOwnerSession(next);
  return next;
}

/**
 * POST /console/refresh — rotate the refresh token and mint a new access
 * token. Single-flighted: concurrent callers share one in-flight refresh.
 * Returns null if there is no session to refresh.
 */
export async function ownerRefresh(): Promise<OwnerSession | null> {
  if (!session?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await postJson("/console/refresh", {
        refreshToken: session!.refreshToken,
      });
      const data = await readJson<{
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
      }>(res);
      if (!res.ok || !data.accessToken || !data.refreshToken) {
        clearOwnerSession();
        return null;
      }
      const next: OwnerSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn ?? 600,
        accessExpiresAt:
          Date.now() + Math.max(5, data.expiresIn ?? 600) * 1000,
      };
      setOwnerSession(next);
      return next;
    } catch {
      clearOwnerSession();
      return null;
    }
  })();
  return refreshPromise;
}

/** POST /console/logout — revoke this device's refresh token. */
export async function ownerLogout(): Promise<void> {
  const refreshToken = session?.refreshToken;
  clearOwnerSession();
  if (!refreshToken) return;
  try {
    await postJson("/console/logout", { refreshToken });
  } catch {
    // Best-effort; the local session is already cleared.
  }
}

/**
 * POST /console/setup-admin — first-time owner setup. Requires the AUTH_PEPPER
 * bootstrap (held in desktop memory only during install). Returns the issued
 * passtoken ONCE; the caller must show it once and let the user download it.
 */
export async function ownerSetupAdmin(input: {
  username: string;
  pepper: string;
}): Promise<{ passtoken: string; username: string }> {
  const res = await postJson(
    "/console/setup-admin",
    { username: input.username.trim() },
    { "X-Auth-Pepper": input.pepper },
  );
  const data = await readJson<{ passtoken?: string; username?: string }>(res);
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Setup failed (${res.status})`);
  }
  return { passtoken: data.passtoken, username: data.username ?? input.username };
}

/**
 * POST /console/rotate-passtoken — re-issue the passtoken (logged-in owner).
 * Returns the new passtoken ONCE and revokes all other sessions.
 */
export async function ownerRotatePasstoken(): Promise<{
  passtoken: string;
  username: string;
}> {
  if (!session?.accessToken) throw new Error("Not logged in.");
  const res = await postJson("/console/rotate-passtoken", null, {
    Authorization: `Bearer ${session.accessToken}`,
  });
  const data = await readJson<{ passtoken?: string; username?: string }>(res);
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Rotate failed (${res.status})`);
  }
  // Rotation revokes all sessions including ours — force re-login.
  clearOwnerSession();
  return { passtoken: data.passtoken, username: data.username ?? "" };
}

/**
 * POST /console/reset-admin — forgot-passtoken recovery. The caller supplies a
 * Cloudflare access token (from the install OAuth flow); the Worker verifies
 * its account matches CF_ACCOUNT_ID and re-issues a passtoken ONCE.
 */
export async function ownerResetAdmin(input: {
  cfAccessToken: string;
  username?: string;
}): Promise<{ passtoken: string; username: string }> {
  const res = await postJson("/console/reset-admin", {
    cfAccessToken: input.cfAccessToken,
    username: input.username?.trim() || undefined,
  });
  const data = await readJson<{ passtoken?: string; username?: string }>(res);
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Reset failed (${res.status})`);
  }
  clearOwnerSession();
  return { passtoken: data.passtoken, username: data.username ?? "" };
}

/** GET /console/connect — owner-session probe (same shape as desktop verify). */
export async function ownerConnectProbe(): Promise<{
  ok: boolean;
  workerUrl: string;
  workerScriptName: string;
  accountId: string;
  [key: string]: unknown;
}> {
  const base = workerBase();
  if (!base) throw new Error("Worker is not connected.");
  const access = await ensureAccessToken();
  if (!access) throw new Error("Not logged in.");
  const res = await fetch(`${base}/console/connect`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = await readJson<{
    ok?: boolean;
    workerScriptName?: string;
    accountId?: string;
    error?: string;
  }>(res);
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Connect failed (${res.status})`);
  }
  return {
    ...data,
    ok: true,
    workerUrl: base,
    workerScriptName: data.workerScriptName ?? "relaybase-api",
    accountId: data.accountId ?? "",
  };
}

/** GET /console/auth-status — public probe: is an owner configured yet? */
export async function ownerAuthStatus(): Promise<{
  ownerConfigured: boolean;
}> {
  const base = workerBase();
  if (!base) return { ownerConfigured: false };
  try {
    const res = await fetch(`${base}/console/auth-status`);
    const data = await readJson<{ ownerConfigured?: boolean }>(res);
    return { ownerConfigured: Boolean(data.ownerConfigured) };
  } catch {
    return { ownerConfigured: false };
  }
}
