"use client";

import { resolveEmailApiBase } from "@/lib/desktop/api";

/**
 * Owner session held in **JS process memory only**.
 *
 * The passtoken, access tokens, and refresh tokens are NEVER written to
 * disk, cookies, localStorage, or sessionStorage. The user keeps the
 * one-time passtoken download; the app holds the session in memory for the
 * lifetime of the process. On desktop, mail refresh lives in the OS keyring
 * and boot unlock is silent (`owner_boot_mail`). Console dashboard access
 * uses Touch ID via `owner_unlock_console` / `ConsoleGateView`. This module
 * is the browser `pnpm next` in-memory session; the Tauri webview uses Rust
 * `worker_request` so JS never sees tokens.
 *
 * The Worker's owner tokens are scoped (`OwnerScope = "mail" | "console"`,
 * see `worker/src/lib/owner-auth.ts`) — a mail-scoped access token 401s on
 * `/console/*` routes and vice versa (`requireOwnerSession` enforces the
 * scope match). `POST /console/login` mints a mail access token directly
 * plus two refresh tokens (mail, console); a console access token needs one
 * extra `POST /console/refresh { refreshToken, scope: "console" }` exchange.
 * This module tracks both scopes so `ensureAccessToken(scope)` always
 * returns a token valid for the routes the caller is about to hit.
 */

export type OwnerScope = "mail" | "console";

export type OwnerSession = {
  accessToken: string;
  refreshToken: string;
  /** Unix ms when the access token expires. */
  accessExpiresAt: number;
  /** Seconds until access expiry, as returned by the Worker. */
  expiresIn: number;
};

let mailSession: OwnerSession | null = null;
let consoleSession: OwnerSession | null = null;
const refreshPromises: Partial<Record<OwnerScope, Promise<OwnerSession | null>>> = {};

function sessionFor(scope: OwnerScope): OwnerSession | null {
  return scope === "mail" ? mailSession : consoleSession;
}

function normalizeSession(next: OwnerSession): OwnerSession {
  return {
    ...next,
    accessExpiresAt:
      next.accessExpiresAt || Date.now() + Math.max(5, next.expiresIn) * 1000,
  };
}

function setSessionFor(scope: OwnerScope, next: OwnerSession | null): void {
  if (scope === "mail") mailSession = next;
  else consoleSession = next;
  delete refreshPromises[scope];
}

/** Console session by default — that's what dashboard/API routes need. */
export function getOwnerSession(scope: OwnerScope = "console"): OwnerSession | null {
  return sessionFor(scope);
}

/** True when either scope has a live session (i.e. the owner is signed in at all). */
export function hasOwnerSession(): boolean {
  return Boolean(consoleSession?.accessToken || mailSession?.accessToken);
}

export function setOwnerSession(next: OwnerSession, scope: OwnerScope = "console"): void {
  setSessionFor(scope, normalizeSession(next));
}

export function clearOwnerSession(): void {
  mailSession = null;
  consoleSession = null;
  delete refreshPromises.mail;
  delete refreshPromises.console;
}

/** Current access token for a scope, or null when not logged in. */
export function getAccessToken(scope: OwnerScope = "console"): string | null {
  return sessionFor(scope)?.accessToken ?? null;
}

/** Access token for a scope, refreshing when it expires within 30s. */
export async function ensureAccessToken(
  scope: OwnerScope = "console",
): Promise<string | null> {
  const current = sessionFor(scope);
  if (!current?.accessToken) return null;
  if (current.accessExpiresAt - Date.now() > 30_000) {
    return current.accessToken;
  }
  const next = await ownerRefresh(scope);
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

/** POST /console/refresh { refreshToken, scope } — mint a fresh scoped access + refresh pair. */
async function exchangeRefreshToken(
  refreshToken: string,
  scope: OwnerScope,
): Promise<OwnerSession | null> {
  try {
    const res = await postJson("/console/refresh", { refreshToken, scope });
    const data = await readJson<{
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    }>(res);
    if (!res.ok || !data.accessToken || !data.refreshToken) {
      return null;
    }
    const next = normalizeSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn ?? 600,
      accessExpiresAt: 0,
    });
    setSessionFor(scope, next);
    return next;
  } catch {
    return null;
  }
}

/**
 * POST /console/login — exchange passtoken for a mail access token plus
 * mail + console refresh tokens. The passtoken is consumed here and not
 * retained. Returns the console session (dashboard access); the mail
 * session is stored alongside it for `/mail/*` calls.
 */
export async function ownerLogin(input: {
  passtoken: string;
  label?: string;
}): Promise<OwnerSession> {
  const res = await postJson("/console/login", {
    passtoken: input.passtoken.trim(),
    label: input.label ?? "desktop",
  });
  const data = await readJson<{
    mailAccessToken?: string;
    mailRefreshToken?: string;
    consoleRefreshToken?: string;
    mailExpiresIn?: number;
  }>(res);
  if (
    !res.ok ||
    !data.mailAccessToken ||
    !data.mailRefreshToken ||
    !data.consoleRefreshToken
  ) {
    throw new Error(data.error || `Login failed (${res.status})`);
  }
  setSessionFor(
    "mail",
    normalizeSession({
      accessToken: data.mailAccessToken,
      refreshToken: data.mailRefreshToken,
      expiresIn: data.mailExpiresIn ?? 600,
      accessExpiresAt: 0,
    }),
  );
  const consoleNext = await exchangeRefreshToken(data.consoleRefreshToken, "console");
  if (!consoleNext) {
    clearOwnerSession();
    throw new Error("Signed in, but console access could not be established.");
  }
  return consoleNext;
}

/**
 * POST /console/refresh — rotate the refresh token and mint a new access
 * token for one scope. Single-flighted per scope. Returns null (and clears
 * that scope) if there is no session, or the refresh is rejected.
 */
export async function ownerRefresh(
  scope: OwnerScope = "console",
): Promise<OwnerSession | null> {
  const current = sessionFor(scope);
  if (!current?.refreshToken) return null;
  const inFlight = refreshPromises[scope];
  if (inFlight) return inFlight;
  const promise = (async () => {
    const next = await exchangeRefreshToken(current.refreshToken, scope);
    if (!next) setSessionFor(scope, null);
    return next;
  })();
  refreshPromises[scope] = promise;
  return promise;
}

/** POST /console/logout — revoke this device's refresh tokens (both scopes, best-effort). */
export async function ownerLogout(): Promise<void> {
  const mailRefresh = mailSession?.refreshToken;
  const consoleRefresh = consoleSession?.refreshToken;
  clearOwnerSession();
  const revoke = async (refreshToken: string | undefined) => {
    if (!refreshToken) return;
    try {
      await postJson("/console/logout", { refreshToken });
    } catch {
      // Best-effort; the local session is already cleared.
    }
  };
  await Promise.all([revoke(mailRefresh), revoke(consoleRefresh)]);
}

/**
 * POST /console/setup-admin — first-time owner setup. Requires the AUTH_PEPPER
 * bootstrap (held in desktop memory only during install). Returns the issued
 * passtoken ONCE; the caller must show it once and let the user download it.
 */
export async function ownerSetupAdmin(input: {
  pepper: string;
}): Promise<{ passtoken: string }> {
  const res = await postJson(
    "/console/setup-admin",
    {},
    { "X-Auth-Pepper": input.pepper },
  );
  const data = await readJson<{ passtoken?: string }>(res);
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Setup failed (${res.status})`);
  }
  return { passtoken: data.passtoken };
}

/**
 * POST /console/rotate-passtoken — re-issue the passtoken (logged-in owner).
 * Returns the new passtoken ONCE and revokes all other sessions.
 */
export async function ownerRotatePasstoken(): Promise<{
  passtoken: string;
}> {
  const access = consoleSession?.accessToken;
  if (!access) throw new Error("Not logged in.");
  const res = await postJson("/console/rotate-passtoken", null, {
    Authorization: `Bearer ${access}`,
  });
  const data = await readJson<{ passtoken?: string }>(res);
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Rotate failed (${res.status})`);
  }
  // Rotation revokes all sessions including ours — force re-login.
  clearOwnerSession();
  return { passtoken: data.passtoken };
}

/**
 * POST /console/reset-admin — forgot-passtoken recovery. The caller supplies a
 * Cloudflare OAuth access token; the Worker proves Secrets Store access on
 * CF_ACCOUNT_ID (or GET /accounts as fallback) and re-issues a passtoken ONCE.
 */
export async function ownerResetAdmin(input: {
  cfAccessToken: string;
}): Promise<{ passtoken: string }> {
  const res = await postJson("/console/reset-admin", {
    cfAccessToken: input.cfAccessToken,
  });
  const data = await readJson<{ passtoken?: string }>(res);
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Reset failed (${res.status})`);
  }
  clearOwnerSession();
  return { passtoken: data.passtoken };
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
  passtokenPrefix: string | null;
}> {
  const base = workerBase();
  return ownerAuthStatusForWorkerUrl(base);
}

/** Same as ownerAuthStatus but for an explicit Worker URL (Setup probe). */
export async function ownerAuthStatusForWorkerUrl(
  workerUrl: string,
): Promise<{ ownerConfigured: boolean; passtokenPrefix: string | null }> {
  const { desktopOwnerAuthStatus } = await import("../bridge/owner");
  return desktopOwnerAuthStatus(workerUrl);
}
