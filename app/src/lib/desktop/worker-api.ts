"use client";

import type { DesktopCredentials } from "@/lib/desktop/bridge";

/**
 * Call the Worker installed in the user's Cloudflare account.
 * Admin routes use the admin token; domain API can use issued keys later.
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
    headers.set("Authorization", `Bearer ${creds.adminToken}`);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
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
