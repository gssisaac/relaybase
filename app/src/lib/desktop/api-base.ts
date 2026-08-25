import { isDesktopRuntime, type DesktopCredentials } from "@/lib/desktop/bridge";
import {
  isAnyApiPath,
  isEmailApiPath,
  mapEmailApiToWorker,
} from "@/lib/desktop/email-api-map";
import { isUnauthorizedGraceActive } from "@/lib/desktop/unauthorized-grace";
import { workerFetch } from "@/lib/desktop/worker-api";

export { mapEmailApiToWorker, mapPackagedEmailApiToWorker } from "@/lib/desktop/email-api-map";

/** Global 401 guard — fires once to clear credentials + redirect to /setup. */
let unauthorizedRedirecting = false;
function handleWorkerUnauthorized(): void {
  if (typeof window === "undefined") return;
  // After ADMIN_TOKEN reissue the new secret can lag; do not latch or wipe.
  if (isUnauthorizedGraceActive()) return;
  if (unauthorizedRedirecting) return;
  unauthorizedRedirecting = true;
  window.dispatchEvent(new CustomEvent("relaybase:unauthorized"));
}

/**
 * Resolve the customer Worker origin when credentials are loaded.
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
 * True when running inside the Tauri webview (packaged or `tauri dev`).
 * Prefer `isWorkerBacked()` for API routing decisions.
 */
export function isPackagedDesktopShell(): boolean {
  if (typeof window === "undefined" || !isDesktopRuntime()) return false;
  const { hostname, protocol } = window.location;
  if (protocol.startsWith("tauri") || protocol.startsWith("asset")) return true;
  if (hostname === "tauri.localhost" || hostname.endsWith(".tauri.localhost")) {
    return true;
  }
  if (hostname === "127.0.0.1" || hostname === "localhost") return false;
  return false;
}

function readDesktopCredentialsFromWindow(): DesktopCredentials | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    __RELAYBASE_WORKER_URL__?: string;
    __RELAYBASE_ADMIN_TOKEN__?: string;
  };
  const workerUrl = w.__RELAYBASE_WORKER_URL__?.trim().replace(/\/$/, "") ?? "";
  const adminToken = w.__RELAYBASE_ADMIN_TOKEN__?.trim() ?? "";
  if (!workerUrl || !adminToken) return null;
  return {
    accountId: "",
    installToken: "",
    serverToken: "",
    serverTokenPushedAt: "",
    workerUrl,
    adminToken,
    workerScriptName: "",
    workerVersion: "",
    licenseKey: "",
    relaybaseAccountId: "",
    relaybaseEmail: "",
    relaybaseSession: "",
    relaybaseTier: "",
    cfOauthAccessToken: "",
    cfOauthRefreshToken: "",
    cfOauthAccessExpiresAt: "",
    cfOauthAccountId: "",
  };
}

function resolveFetchUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const local = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return local;
  try {
    return new URL(local, window.location.href).href;
  } catch {
    return local;
  }
}

/**
 * Normalize a dashboard API path for fetch.
 */
export function mapEmailPath(path: string): {
  url: string;
  useAdminToken: boolean;
} {
  if (/^https?:\/\//i.test(path)) {
    return { url: path, useAdminToken: false };
  }
  const local = path.startsWith("/") ? path : `/${path}`;
  return { url: resolveFetchUrl(local), useAdminToken: false };
}

const WEBKIT_PATTERN_ERR = /string did not match the expected pattern/i;
/** Safari / WKWebView TypeError when CORS or network blocks fetch. */
const WEBKIT_LOAD_FAILED_ERR = /^(load failed|failed to fetch)$/i;

export const API_UNAVAILABLE =
  "Live API unavailable. Cached data is shown when available.";
export const API_NOT_WIRED = "This feature is not available yet.";

/** @deprecated Use API_UNAVAILABLE */
export const PACKAGED_API_UNAVAILABLE = API_UNAVAILABLE;
/** @deprecated Use API_NOT_WIRED */
export const PACKAGED_API_NOT_WIRED = API_NOT_WIRED;

export function isApiUnavailableError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return (
    msg.includes("packaged app") ||
    msg.includes("Live API unavailable") ||
    msg === API_NOT_WIRED ||
    msg === PACKAGED_API_NOT_WIRED ||
    WEBKIT_PATTERN_ERR.test(msg) ||
    WEBKIT_LOAD_FAILED_ERR.test(msg.trim())
  );
}

/** @deprecated Use isApiUnavailableError */
export const isPackagedApiUnavailableError = isApiUnavailableError;

export async function readResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(res.ok ? "Empty response" : `Request failed (${res.status})`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    const looksHtml = trimmed.startsWith("<!") || trimmed.startsWith("<html");
    if (looksHtml || WEBKIT_PATTERN_ERR.test(String(err))) {
      throw new Error(
        isWorkerBacked() || isPackagedDesktopShell()
          ? API_UNAVAILABLE
          : `API returned non-JSON (${res.status})`,
      );
    }
    throw err instanceof Error ? err : new Error("Invalid JSON response");
  }
}

export function friendlyDesktopFetchError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const trimmed = raw.trim();
  if (
    WEBKIT_PATTERN_ERR.test(trimmed) ||
    WEBKIT_LOAD_FAILED_ERR.test(trimmed) ||
    trimmed === API_UNAVAILABLE ||
    trimmed === API_NOT_WIRED ||
    trimmed === PACKAGED_API_UNAVAILABLE ||
    trimmed === PACKAGED_API_NOT_WIRED
  ) {
    return trimmed === API_NOT_WIRED || trimmed === PACKAGED_API_NOT_WIRED
      ? API_NOT_WIRED
      : API_UNAVAILABLE;
  }
  return trimmed || fallback;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * All run modes (browser next, tauri dev, packaged) route `/api/email/*`
 * through the Worker when credentials are loaded on `window`.
 */
export async function desktopAwareFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const mapped = mapEmailApiToWorker(path);
  if (mapped === "empty-sent") {
    return jsonResponse({ sent: [], items: [] });
  }
  if (mapped) {
    const creds = readDesktopCredentialsFromWindow();
    if (!creds) {
      throw new Error(
        "Worker is not connected. Finish setup to load live mail.",
      );
    }
    let workerPath = mapped;
    const method = (init?.method ?? "GET").toUpperCase();
    if (
      method === "POST" &&
      workerPath.startsWith("/mail/inbox/notifications") &&
      !workerPath.startsWith("/mail/inbox/notifications/ack")
    ) {
      const q = workerPath.includes("?")
        ? workerPath.slice(workerPath.indexOf("?"))
        : "";
      workerPath = `/mail/inbox/notifications/ack${q}`;
    }
    // Domains onboard was a Next-only pipeline; treat as GET domains refresh.
    if (
      method === "POST" &&
      splitPathname(path).includes("/domains/onboard")
    ) {
      try {
        const res = await workerFetch(creds, "/console/domains");
        const data = (await res.json().catch(() => ({}))) as {
          domains?: unknown[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load domains");
        }
        return jsonResponse({
          domains: data.domains ?? [],
          message: "Domain ready",
        });
      } catch (err) {
        throw new Error(friendlyDesktopFetchError(err, "Worker request failed"));
      }
    }
    try {
      const res = await workerFetch(creds, workerPath, init);
      if (res.status === 401) {
        handleWorkerUnauthorized();
      }
      return res;
    } catch (err) {
      throw new Error(friendlyDesktopFetchError(err, "Worker request failed"));
    }
  }

  if (isEmailApiPath(path)) {
    throw new Error(API_NOT_WIRED);
  }
  if (isAnyApiPath(path) && (isWorkerBacked() || isPackagedDesktopShell())) {
    throw new Error(API_UNAVAILABLE);
  }

  const { url } = mapEmailPath(path);
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Error(friendlyDesktopFetchError(err, "Request failed"));
  }
}

function splitPathname(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    try {
      return new URL(path).pathname;
    } catch {
      return path;
    }
  }
  const local = path.startsWith("/") ? path : `/${path}`;
  const q = local.indexOf("?");
  return q < 0 ? local : local.slice(0, q);
}
