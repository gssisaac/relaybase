"use client";

import type { DesktopCredentials } from "@/lib/desktop/bridge";

/**
 * Call the Worker installed in the user's Cloudflare account.
 * Owner routes use the in-memory access token (passtoken is never sent again).
 */
export async function workerFetch(
  creds: DesktopCredentials,
  path: string,
  init?: RequestInit & { admin?: boolean },
): Promise<Response> {
  const base = creds.workerUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    const { ensureAccessToken } = await import("@/lib/desktop/owner-session");
    const access = await ensureAccessToken();
    if (access) {
      headers.set("Authorization", `Bearer ${access}`);
    }
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status !== 401 || headers.has("X-Relaybase-Retried")) {
    return res;
  }
  const { ownerRefresh } = await import("@/lib/desktop/owner-session");
  const next = await ownerRefresh();
  if (!next?.accessToken) return res;
  const retryHeaders = new Headers(headers);
  retryHeaders.set("Authorization", `Bearer ${next.accessToken}`);
  retryHeaders.set("X-Relaybase-Retried", "1");
  return fetch(url, { ...init, headers: retryHeaders });
}

export async function workerAdminJson<T>(
  creds: DesktopCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await workerFetch(creds, path, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Worker error ${res.status}`,
    );
  }
  return data;
}
