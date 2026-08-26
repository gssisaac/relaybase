"use client";

import type { DesktopCredentials } from "@/lib/desktop/bridge";
import { desktopWorkerRequest, isDesktopRuntime } from "@/lib/desktop/bridge";

/**
 * Call the Worker installed in the user's Cloudflare account.
 *
 * Desktop: Rust `worker_request` attaches the in-memory access token.
 * Tokens never enter JS. Browser `pnpm next`: JS-memory session Bearer.
 */
export async function workerFetch(
  creds: DesktopCredentials,
  path: string,
  init?: RequestInit & { admin?: boolean },
): Promise<Response> {
  if (isDesktopRuntime()) {
    const headers: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value;
      });
    }
    if (init?.body && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    let body: string | undefined;
    if (typeof init?.body === "string") {
      body = init.body;
    } else if (init?.body) {
      body = String(init.body);
    }
    const result = await desktopWorkerRequest({
      method: (init?.method ?? "GET").toUpperCase(),
      path,
      headers,
      body,
    });
    const resHeaders = new Headers();
    for (const [k, v] of result.headers) {
      resHeaders.append(k, v);
    }
    return new Response(result.body, {
      status: result.status,
      headers: resHeaders,
    });
  }

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
