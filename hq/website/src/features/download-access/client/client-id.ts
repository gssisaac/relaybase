"use client";

import {
  CLIENT_ID_COOKIE_KEY,
  CLIENT_ID_COOKIE_MAX_AGE_SEC,
  CLIENT_ID_STORAGE_KEY,
  DIRECT_DOWNLOAD_API_PATH,
  PRODUCTION_SITE_ORIGIN,
  UUID_V4_RE,
  isLocalDevHost,
} from "../shared/constants";

let memoryClientId: string | null = null;

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  let cookie = `${name}=${encoded}; path=/; max-age=${CLIENT_ID_COOKIE_MAX_AGE_SEC}; samesite=lax`;
  const host = window.location.hostname;
  if (host === "relaybase.xyz" || host.endsWith(".relaybase.xyz")) {
    cookie += "; domain=.relaybase.xyz; secure";
  }
  document.cookie = cookie;
}

function readStoredClientId(): string | null {
  try {
    const fromStorage = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
    if (fromStorage && UUID_V4_RE.test(fromStorage)) {
      return fromStorage;
    }
  } catch {
    // localStorage may be blocked — fall through to cookie.
  }

  const fromCookie = readCookie(CLIENT_ID_COOKIE_KEY);
  if (fromCookie && UUID_V4_RE.test(fromCookie)) {
    return fromCookie;
  }

  return null;
}

function persistClientId(id: string): void {
  memoryClientId = id;

  try {
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  } catch {
    // Cookie remains the fallback when localStorage is unavailable.
  }

  try {
    writeCookie(CLIENT_ID_COOKIE_KEY, id);
  } catch {
    // Memory cache still dedupes within the same tab session.
  }
}

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";

  if (memoryClientId && UUID_V4_RE.test(memoryClientId)) {
    return memoryClientId;
  }

  const existing = readStoredClientId();
  if (existing) {
    persistClientId(existing);
    return existing;
  }

  const next = createClientId();
  persistClientId(next);
  return next;
}

/** Call on mount so the ID exists before the first download click. */
export function ensureDownloadClientId(): void {
  getOrCreateClientId();
}

export function resolveDirectDownloadApiUrl(): string {
  if (typeof window === "undefined") {
    return DIRECT_DOWNLOAD_API_PATH;
  }

  // next dev has no website Worker — track against production D1 instead.
  if (isLocalDevHost(window.location.hostname)) {
    return `${PRODUCTION_SITE_ORIGIN}${DIRECT_DOWNLOAD_API_PATH}`;
  }

  return DIRECT_DOWNLOAD_API_PATH;
}
