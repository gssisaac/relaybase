/**
 * Resolve the API base for email dashboard fetches.
 * Desktop (Tauri): Worker URL + /v1 or /admin depending on path.
 * Browser/dev: Next `/api/email` proxy.
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

/** Map legacy `/api/email/...` paths to Worker routes when desktop-connected. */
export function mapEmailPath(path: string): {
  url: string;
  useAdminToken: boolean;
} {
  const worker = resolveEmailApiBase();
  if (!worker) {
    return { url: path.startsWith("/") ? path : `/${path}`, useAdminToken: false };
  }

  // Normalize: callers often pass `/api/email/foo` or `foo`
  let p = path;
  if (p.startsWith("/api/email")) p = p.slice("/api/email".length) || "/";
  if (!p.startsWith("/")) p = `/${p}`;

  const adminPaths = [
    "/keys",
    "/inbox",
    "/logs",
    "/inbound-routing",
  ];
  const useAdmin = adminPaths.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );

  if (p.startsWith("/keys") || p === "/keys") {
    return { url: `${worker}/admin/keys${p === "/keys" ? "" : p.slice("/keys".length)}`, useAdminToken: true };
  }
  if (p.startsWith("/inbox")) {
    return { url: `${worker}/admin/inbox${p.slice("/inbox".length)}`, useAdminToken: true };
  }
  if (p.startsWith("/send") || p === "/send") {
    return { url: `${worker}/v1/send`, useAdminToken: false };
  }

  // Default: try v1 path (send/inbox events/webhooks)
  if (useAdmin) {
    return { url: `${worker}/admin${p}`, useAdminToken: true };
  }
  return { url: `${worker}/v1${p}`, useAdminToken: true };
}

export async function desktopAwareFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { url, useAdminToken } = mapEmailPath(path);
  const headers = new Headers(init?.headers);
  if (useAdminToken && typeof window !== "undefined") {
    const w = window as unknown as { __RELAYBASE_ADMIN_TOKEN__?: string };
    if (w.__RELAYBASE_ADMIN_TOKEN__ && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${w.__RELAYBASE_ADMIN_TOKEN__}`);
    }
  }
  return fetch(url, { ...init, headers });
}
