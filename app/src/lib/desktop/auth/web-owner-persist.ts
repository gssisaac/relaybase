import { isDesktopRuntime } from "../bridge/invoke";

/**
 * Web-only owner refresh persistence (N-01 web fallback).
 *
 * The browser build has no OS keyring, so the owner's **refresh** tokens are
 * mirrored to this tab's `sessionStorage` to survive a same-tab hard reload.
 * Access JWTs stay in JS memory and are re-minted via `/console/refresh`; the
 * passtoken is never stored. Closing the tab drops the session.
 *
 * Desktop never reads or writes this key — its refresh tokens live in the OS
 * keyring behind Rust (`owner-session:{workerUrl}`).
 */
export const WEB_OWNER_SESSION_KEY = "relaybase:owner-session";

export type StoredWebOwnerSession = {
  workerUrl: string;
  mailRefreshToken: string;
  consoleRefreshToken: string;
};

function webStorage(): Storage | null {
  if (typeof window === "undefined" || isDesktopRuntime()) return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readWebOwnerSession(): StoredWebOwnerSession | null {
  const storage = webStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEB_OWNER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWebOwnerSession>;
    const workerUrl = parsed.workerUrl?.trim().replace(/\/$/, "") ?? "";
    const mailRefreshToken = parsed.mailRefreshToken ?? "";
    const consoleRefreshToken = parsed.consoleRefreshToken ?? "";
    if (!workerUrl || (!mailRefreshToken && !consoleRefreshToken)) return null;
    return { workerUrl, mailRefreshToken, consoleRefreshToken };
  } catch {
    return null;
  }
}

/** Overwrite (or remove, when there is nothing to keep) the stored refresh pair. */
export function writeWebOwnerSession(next: StoredWebOwnerSession | null): void {
  const storage = webStorage();
  if (!storage) return;
  try {
    const workerUrl = next?.workerUrl.trim().replace(/\/$/, "") ?? "";
    if (!next || !workerUrl || (!next.mailRefreshToken && !next.consoleRefreshToken)) {
      storage.removeItem(WEB_OWNER_SESSION_KEY);
      return;
    }
    const snapshot: StoredWebOwnerSession = {
      workerUrl,
      mailRefreshToken: next.mailRefreshToken,
      consoleRefreshToken: next.consoleRefreshToken,
    };
    storage.setItem(WEB_OWNER_SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // private mode / quota — the session just won't survive a reload
  }
}

export function clearWebOwnerSessionStorage(): void {
  writeWebOwnerSession(null);
}

export function hasStoredWebOwnerSession(): boolean {
  return readWebOwnerSession() !== null;
}
