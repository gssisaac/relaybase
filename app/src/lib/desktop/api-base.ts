/**
 * Resolve the customer Worker origin when desktop credentials are loaded.
 * Used for health/examples — not for rewriting dashboard `/api/email` fetches.
 */
export function resolveEmailApiBase(): string {
  if (typeof window !== "undefined") {
    const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
    if (w.__RELAYBASE_WORKER_URL__) {
      return w.__RELAYBASE_WORKER_URL__.replace(/\/$/, "");
    }
  }
  return "";
}

export function isWorkerBacked(): boolean {
  return Boolean(resolveEmailApiBase());
}

/**
 * Normalize a dashboard API path for fetch.
 * Absolute URLs pass through; relative paths stay on the Next app.
 * (Previously we rewrote to the Worker and broke Tauri with invalid/CORS URLs.)
 */
export function mapEmailPath(path: string): {
  url: string;
  useAdminToken: boolean;
} {
  if (/^https?:\/\//i.test(path)) {
    return { url: path, useAdminToken: false };
  }
  const local = path.startsWith("/") ? path : `/${path}`;
  return { url: local, useAdminToken: false };
}

export async function desktopAwareFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { url } = mapEmailPath(path);
  return fetch(url, init);
}
