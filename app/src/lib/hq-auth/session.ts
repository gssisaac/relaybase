"use client";

import { getStudioApiBase } from "@/studio/api";

export type HqUser = {
  id: string;
  email: string;
  name: string | null;
  accountLinkId: string;
  username?: string | null;
  cfAccountId?: string | null;
  workerUrl?: string | null;
};

type AuthPayload = {
  accessToken: string;
  expiresIn: number;
  user: HqUser;
};

let accessToken: string | null = null;
let accessExpiresAt = 0;
let cachedUser: HqUser | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function applyHqAuthPayload(payload: AuthPayload): void {
  accessToken = payload.accessToken;
  accessExpiresAt = Date.now() + Math.max(5, payload.expiresIn) * 1000;
  cachedUser = payload.user;
  emit();
}

export function subscribeHqAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHqAccessToken(): string | null {
  if (!accessToken) return null;
  if (accessExpiresAt - Date.now() < 30_000) return null;
  return accessToken;
}

export function getHqUser(): HqUser | null {
  return cachedUser;
}

export function hasHqSession(): boolean {
  return Boolean(getHqAccessToken() && cachedUser);
}

/** UI / mode switcher — true while Studio identity remains (incl. refresh pending). */
export function isHqStudioSignedIn(): boolean {
  return cachedUser !== null;
}

export function clearHqSession(): void {
  accessToken = null;
  accessExpiresAt = 0;
  cachedUser = null;
  emit();
}

class AuthFetchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getHqAccessToken();
  const res = await fetch(`${getStudioApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    let message = body?.error ?? `Request failed (${res.status})`;
    if (res.status === 404 && path.startsWith("/auth/")) {
      message =
        "Studio auth API not found — start hq/studio on port 32832 (not 32831; that port is used by Relaybase desktop OAuth).";
    }
    throw new AuthFetchError(res.status, message);
  }
  if (body === null) {
    throw new Error("Empty response");
  }
  return body as T;
}

let hqRefreshInFlight: Promise<boolean> | null = null;

export type HqSignupWorkerProof =
  | { kind: "owner"; passtoken: string }
  | { kind: "team"; accountEmail: string; teamPassword: string };

export async function hqSignup(input: {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  workerUrl: string;
  workerProof: HqSignupWorkerProof;
}): Promise<HqUser> {
  const payload = await authFetch<AuthPayload>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  applyHqAuthPayload(payload);
  return payload.user;
}

export async function hqLogin(input: {
  email?: string;
  username?: string;
  password: string;
}): Promise<HqUser> {
  const payload = await authFetch<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      password: input.password,
    }),
  });
  applyHqAuthPayload(payload);
  return payload.user;
}

/** Restore HQ session from 30-day refresh cookie (RTR). */
export async function hqRefreshSession(): Promise<boolean> {
  if (hqRefreshInFlight) return hqRefreshInFlight;

  hqRefreshInFlight = (async () => {
    try {
      const payload = await authFetch<AuthPayload>("/auth/refresh", {
        method: "POST",
        body: "{}",
      });
      applyHqAuthPayload(payload);
      return true;
    } catch (err) {
      const status = err instanceof AuthFetchError ? err.status : 0;
      if (status === 401 || status === 403) {
        clearHqSession();
      }
      return false;
    } finally {
      hqRefreshInFlight = null;
    }
  })();

  return hqRefreshInFlight;
}

export async function hqLogout(): Promise<void> {
  try {
    await authFetch<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: "{}",
    });
  } catch {
    /* best-effort */
  }
  clearHqSession();
}

export async function hqRequestPasswordReset(email: string): Promise<void> {
  await authFetch<{ ok: boolean; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function hqResetPassword(token: string, newPassword: string): Promise<HqUser> {
  const payload = await authFetch<AuthPayload>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
  applyHqAuthPayload(payload);
  return payload.user;
}

export async function hqFetchMe(): Promise<HqUser> {
  const payload = await authFetch<{ user: HqUser }>("/auth/me");
  cachedUser = payload.user;
  emit();
  return payload.user;
}

export async function hqUpdateProfile(name: string): Promise<HqUser> {
  const payload = await authFetch<{ user: HqUser }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  cachedUser = payload.user;
  emit();
  return payload.user;
}

export async function hqChangePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await authFetch<{ ok: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
