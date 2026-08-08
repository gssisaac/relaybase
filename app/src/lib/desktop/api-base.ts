/**
 * Resolve the API base for email dashboard fetches.
 * Desktop (Tauri): only known Worker routes go to the customer Worker.
 * Everything else (domains, stats, audience, …) stays on the Next `/api/email` app.
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

function splitPath(path: string): { pathname: string; search: string } {
  const local = path.startsWith("/") ? path : `/${path}`;
  const q = local.indexOf("?");
  if (q < 0) return { pathname: local, search: "" };
  return { pathname: local.slice(0, q), search: local.slice(q) };
}

function stripEmailPrefix(pathname: string): string {
  let p = pathname;
  if (p.startsWith("/api/email")) p = p.slice("/api/email".length) || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

/**
 * Map legacy `/api/email/...` paths to Worker routes when desktop-connected.
 * Unknown paths stay on the Next app — the Worker does not implement domains/stats/etc.
 */
export function mapEmailPath(path: string): {
  url: string;
  useAdminToken: boolean;
} {
  const { pathname, search } = splitPath(path);
  const local = `${pathname}${search}`;
  const worker = resolveEmailApiBase();
  if (!worker) {
    return { url: local, useAdminToken: false };
  }

  const p = stripEmailPrefix(pathname);

  // Whitelist only routes that exist on the customer Worker (server/src/app.ts).
  if (p === "/keys" || p.startsWith("/keys/")) {
    const rest = p === "/keys" ? "" : p.slice("/keys".length);
    return {
      url: `${worker}/admin/keys${rest}${search}`,
      useAdminToken: true,
    };
  }
  if (p === "/inbox" || p.startsWith("/inbox/")) {
    return {
      url: `${worker}/admin/inbox${p.slice("/inbox".length)}${search}`,
      useAdminToken: true,
    };
  }
  if (p === "/logs" || p.startsWith("/logs/")) {
    return {
      url: `${worker}/admin/logs${p.slice("/logs".length)}${search}`,
      useAdminToken: true,
    };
  }
  if (p === "/send") {
    return { url: `${worker}/v1/send${search}`, useAdminToken: false };
  }

  // Domains, addresses, stats, audience, broadcasts, … → Next app
  return { url: local, useAdminToken: false };
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
