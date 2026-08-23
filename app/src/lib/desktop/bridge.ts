import {
  d1BindingFromPayload,
  type D1BindingSnapshot,
} from "@/lib/dashboard/d1-binding-status";
import { probeD1WhenConnectOmits } from "@/lib/dashboard/d1-fallback-probe";

export type DesktopCredentials = {
  accountId: string;
  /** Cloudflare OAuth access token (memory overlay) or legacy disk install token. */
  installToken: string;
  /** Cloudflare token with Email Sending Edit, pushed to Worker as CF_API_TOKEN. */
  serverToken: string;
  /** ISO timestamp of last successful Worker `CF_API_TOKEN` secret push. */
  serverTokenPushedAt: string;
  workerUrl: string;
  adminToken: string;
  workerScriptName: string;
  /** Deployed Worker bundle version (WORKER_VERSION). */
  workerVersion: string;
  licenseKey: string;
  /** Relaybase console account (console.relaybase.xyz). */
  relaybaseAccountId: string;
  relaybaseEmail: string;
  /** Signed session token, stored locally only. */
  relaybaseSession: string;
  /** License tier mirrored from the console ("free" | "pro"). */
  relaybaseTier: string;
  // --- Cloudflare OAuth (install token) ---
  // Short-lived access token; kept in sync with `installToken` so existing
  // wrangler/CF-API call sites work unchanged. Populated from Tauri process
  // memory only — never persisted to ~/.relaybase.
  cfOauthAccessToken: string;
  // Long-lived refresh token; process memory only (Tauri desktop).
  cfOauthRefreshToken: string;
  // ISO timestamp of access-token expiry.
  cfOauthAccessExpiresAt: string;
  // Cloudflare account id resolved from the OAuth flow.
  cfOauthAccountId: string;
};

export type ZoneSummary = {
  id: string;
  name: string;
  status: string;
};

export type InstallResult = {
  workerUrl: string;
  workerScriptName: string;
  adminToken: string;
  r2Bucket: string;
  skipped: boolean;
  adminRelinked: boolean;
};

export type AutoInstallResult = {
  workerUrl: string;
  workerScriptName: string;
  adminToken: string;
  r2Bucket: string;
  d1LogsId: string;
  d1InboxIndexId: string;
  d1DbId: string;
  dbAlreadyInitialized: boolean;
  dbApplied: string[];
  workerVersion: string;
};

export type InitDbResult = {
  ok: boolean;
  alreadyInitialized: boolean;
  applied: string[];
  skipped: string[];
  cleared: boolean;
};

export type InstallResourceProbe = {
  kind: "worker" | "r2" | "d1" | string;
  name: string;
  present: boolean;
  id: string;
  objectCount?: number | null;
  rowCount?: number | null;
  truncated?: boolean;
  occupied?: boolean;
};

export type InstallProbeResult = {
  accountId: string;
  resources: InstallResourceProbe[];
};

export type InstallDecision = {
  kind: string;
  name: string;
  action: "skip" | "reinstall";
};

export type InstallLogEvent = {
  step: string;
  level: "stdout" | "stderr" | "info";
  line: string;
};

export type ResourceCheck = {
  name: string;
  kind: string;
  present: boolean;
  detail: string;
};

export type ProbeResult = {
  status: "ready" | "partial" | "missing" | string;
  workerScriptName: string;
  workerUrl: string | null;
  healthOk: boolean;
  resources: ResourceCheck[];
  summary: string;
};

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function getInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: TauriInvoke };
    __TAURI__?: { core?: { invoke: TauriInvoke } };
  };
  return w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.core?.invoke ?? null;
}

export function isDesktopRuntime(): boolean {
  return getInvoke() !== null;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = getInvoke();
  if (!fn) throw new Error("Not running inside the Relaybase desktop app");
  try {
    return await fn<T>(cmd, args);
  } catch (err) {
    // Tauri rejects with a raw string / object, not always Error.
    throw new Error(formatDesktopError(err));
  }
}

/** Normalize Tauri invoke / JS errors into a readable string. */
export function formatDesktopError(err: unknown): string {
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}" && json !== "null") return json;
    } catch {
      /* ignore */
    }
  }
  return "Unknown error";
}

export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";

/** Hosted install ZIP (packed via `pnpm pack:worker-install`). */
export const WORKER_INSTALL_ZIP_URL =
  process.env.NEXT_PUBLIC_WORKER_INSTALL_ZIP_URL ??
  "https://relaybase.xyz/downloads/relaybase-worker-install.zip";

/** Hosted install manifest (version, zipUrl, sha256). */
export const WORKER_INSTALL_MANIFEST_URL =
  process.env.NEXT_PUBLIC_WORKER_INSTALL_MANIFEST_URL ??
  "https://relaybase.xyz/downloads/worker-install-manifest.json";

export type WorkerInstallManifest = {
  version: string;
  zipUrl: string;
  zipSha256: string;
  publishedAt: string;
};

export type WorkerUpdateCheck = {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion?: string | null;
  zipUrl?: string | null;
  zipSha256?: string | null;
};

/**
 * Optional Cloudflare API token scopes for Zone / Email assist
 * (Domains import, routing automation). Not required for Worker self-install.
 */
export const CF_REQUIRED_TOKEN_PERMISSIONS = [
  "Account — Email Sending — Edit",
  "Zone — Email Routing Rules — Edit",
  "Zone — Zone — Read",
] as const;

/** Scopes needed for desktop auto-install (Wrangler deploy + R2 + D1). */
export const CF_INSTALL_TOKEN_PERMISSIONS = [
  "Account — Workers Scripts — Edit",
  "Account — Workers R2 Storage — Edit",
  "Account — D1 — Edit",
] as const;

/** Human-readable OAuth scopes shown during Setup → Authorize with Cloudflare. */
export const CF_OAUTH_INSTALL_SCOPES = [
  "D1 Write",
  "Secrets Store Write",
  "Workers R2 Storage Write",
  "Workers Scripts Write",
] as const;

/** Max wait after opening the Cloudflare authorize URL before treating as cancelled. */
export const CF_OAUTH_AUTHORIZE_WAIT_MS = 3 * 60 * 1000;

/** Remove ANSI color/style escapes from wrangler CLI output. */
export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

/** Cloudflare dashboard → this account's relaybase-api Worker. */
export function cloudflareWorkersDashboardUrl(
  accountId: string,
  scriptName = "relaybase-api",
): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/workers/services/view/${encodeURIComponent(scriptName)}/production`;
}

/** Cloudflare dashboard → this account's R2 home (not checkout). */
export function cloudflareR2DashboardUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/r2`;
}

/** Cloudflare dashboard → this account's R2 bucket list. */
export function cloudflareR2OverviewUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/r2/overview`;
}

/** Cloudflare dashboard → this account's D1 databases. */
export function cloudflareD1DashboardUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/workers/d1`;
}

/** Cloudflare dashboard → Worker service page (no /production suffix). */
export function cloudflareWorkerServiceUrl(
  accountId: string,
  scriptName = "relaybase-api",
): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/workers/services/view/${encodeURIComponent(scriptName)}`;
}

export function cloudflareInstallDashboardLinks(accountId: string): {
  label: string;
  href: string;
}[] {
  return [
    { label: "Worker", href: cloudflareWorkerServiceUrl(accountId) },
    { label: "D1", href: cloudflareD1DashboardUrl(accountId) },
    { label: "R2", href: cloudflareR2OverviewUrl(accountId) },
  ];
}

function accountIdFromCfError(raw: string): string {
  const dash = raw.match(/dash\.cloudflare\.com\/([a-f0-9]{32})(?:\/r2)?/i);
  if (dash?.[1]) return dash[1];
  const accounts = raw.match(/\/accounts\/([a-f0-9]{32})\//i);
  return accounts?.[1] ?? "";
}

export function oauthAuthorizationIncompleteHelp(
  reason: "timeout" | "cancelled" = "timeout",
): DesktopErrorHelp {
  return {
    title: "Authorization didn't complete",
    detail:
      reason === "cancelled"
        ? "Cloudflare authorization was cancelled before Relaybase could connect."
        : "Cloudflare authorization timed out. The browser window may still be open — close it and try again.",
    fix: "Click Authorize with Cloudflare to start again.",
  };
}

export type WorkerConnectResult = {
  ok: boolean;
  product: string;
  version: string;
  workerScriptName: string;
  workerUrl: string;
  /** CF account id reported by the Worker (from CF_ACCOUNT_ID secret). */
  accountId: string;
  r2Configured: boolean;
  inboundBucketName: string;
  /** Sum of inbound R2 object sizes in bytes, when the Worker reported usage. */
  r2TotalBytes?: number | null;
  r2ObjectCount?: number | null;
  /** True when the Worker stopped scanning early (large bucket). */
  r2UsageTruncated?: boolean | null;
  /** True when the Worker has a CF_API_TOKEN wrangler secret set. */
  cfApiTokenSet?: boolean;
  d1Logs: D1BindingSnapshot;
  d1InboxIndex: D1BindingSnapshot;
  d1App: D1BindingSnapshot;
};

export type DesktopErrorLink = {
  label: string;
  href: string;
};

export type DesktopErrorHelp = {
  title: string;
  /** Short human-readable explanation — never raw API JSON. */
  detail: string;
  fix: string;
  links?: DesktopErrorLink[];
  /** Cloudflare API token scopes to grant when the error is auth/permission related. */
  permissions?: readonly string[];
};

function stripRawApiNoise(raw: string): string {
  // Drop Cloudflare-style JSON error arrays / payloads from user-facing text.
  return raw
    .replace(/:\s*\[\{[\s\S]*\}\]\s*$/g, "")
    .replace(/\{[\s\S]*"code"\s*:\s*\d+[\s\S]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map common desktop failures to a short title + what to do next. */
export function explainDesktopError(
  err: unknown,
  fallbackTitle = "Something went wrong",
  opts?: { accountId?: string },
): DesktopErrorHelp {
  const raw = formatDesktopError(err);
  const lower = raw.toLowerCase();
  const installLinks: DesktopErrorLink[] = [
    { label: "Download Worker install ZIP", href: WORKER_INSTALL_ZIP_URL },
    { label: "Open install setup", href: "/setup/install" },
  ];

  if (
    lower.includes("~/.relaybase") ||
    lower.includes(".relaybase") ||
    lower.includes("credentials.json") ||
    lower.includes("could not resolve home") ||
    lower.includes("failed to create") ||
    lower.includes("failed to write credentials")
  ) {
    return {
      title: "Could not save credentials on this Mac",
      detail: stripRawApiNoise(raw) || "Could not create or write ~/.relaybase/credentials.json.",
      fix: "Relaybase creates ~/.relaybase automatically. Ensure your home folder is writable, then Verify again. To reset, delete ~/.relaybase/credentials.json.",
    };
  }

  if (
    lower.includes("admin token was rejected") ||
    lower.includes("unauthorized") ||
    lower.includes("status: 401") ||
    lower.includes("(401)")
  ) {
    return {
      title: "Admin token was rejected",
      detail:
        "The Worker URL responded, but the admin token did not match ADMIN_TOKEN on that Worker.",
      fix: "In the Admin token field above, paste the secret you set with wrangler (or Generate → Copy wrangler command → run it, then Verify with that same token).",
      links: installLinks,
    };
  }

  if (
    lower.includes("could not reach worker") ||
    lower.includes("error sending request") ||
    lower.includes("timed out") ||
    lower.includes("dns")
  ) {
    return {
      title: "Could not reach your Worker",
      detail:
        "This Mac could not call the Worker URL. Check the URL, that deploy finished, and your network.",
      fix: "Open the URL + `/health` in a browser. If that fails, redeploy from the install ZIP.",
      links: installLinks,
    };
  }

  if (
    lower.includes("internal server error") &&
    (lower.includes("init-db") || lower.includes("owner_config") || lower.includes("hosted"))
  ) {
    return {
      title: "Worker is an older build",
      detail:
        "D1 is bound on this Worker. The hosted 0.2.0 build crashes while reading owner_config before migrations run — that is not a Cloudflare permission error.",
      fix: "Click Try again so Relaybase re-uploads the local worker.js. Verify now cannot replace the Worker.",
    };
  }

  if (
    lower.includes("does not look like a relaybase") ||
    lower.includes("not with a relaybase connect") ||
    lower.includes("connect check failed")
  ) {
    return {
      title: "Not a Relaybase Worker",
      detail:
        "The URL is reachable but did not return a Relaybase connect response. The hosted Worker crashes on empty D1 while checking admin auth.",
      fix: "Click Try again to re-upload the Worker. Verify now only retries connect — it does not replace worker.js.",
    };
  }

  if (lower.includes("worker url")) {
    return {
      title: "Worker URL looks invalid",
      detail: stripRawApiNoise(raw) || "Enter your workers.dev HTTPS URL.",
      fix: "Example: https://relaybase-api.<your-subdomain>.workers.dev",
      links: installLinks,
    };
  }

  if (
    lower.includes("cloudflare_auth_expired") ||
    lower.includes("code: 9109") ||
    lower.includes("invalid access token")
  ) {
    return {
      title: "Cloudflare authorization expired",
      detail:
        "The install token expired and Relaybase has no refresh token to renew it.",
      fix: "Go back and Authorize Cloudflare again. After connecting, install will re-check existing resources.",
    };
  }

  if (
    lower.includes("r2_subscription_required") ||
    lower.includes("10042") ||
    lower.includes("enable r2") ||
    (lower.includes("r2") && lower.includes("subscription"))
  ) {
    const href = cloudflareR2DashboardUrl(
      accountIdFromCfError(raw) || opts?.accountId?.trim() || "",
    );
    return {
      title: "Cloudflare R2 is not active",
      detail:
        "This Cloudflare account has no R2 product. Cloudflare sometimes removes the unused $0 subscription a few days after first use. Mail cannot be stored until R2 is added back.",
      fix: "Open R2 in the Cloudflare dashboard, add R2 to the account if prompted, then return here and Try again.",
      links: [{ label: "Open R2 in Cloudflare", href }],
    };
  }

  if (lower.includes("install_cancelled")) {
    return {
      title: "Installation stopped",
      detail:
        "Install was stopped. Resources created in this run were removed from your Cloudflare account.",
      fix: "Click Try again to start a new install, or go back to setup.",
    };
  }

  const cleaned = stripRawApiNoise(raw);

  if (
    fallbackTitle.toLowerCase().includes("existing resources") ||
    lower.includes("403") ||
    lower.includes("forbidden")
  ) {
    return {
      title: fallbackTitle,
      detail:
        cleaned && cleaned.length < 280
          ? cleaned
          : "Cloudflare refused the resource check with this install token.",
      fix: "Tap Try again. If it keeps failing, go back and Authorize Cloudflare again so Relaybase can list Workers, R2, and D1.",
    };
  }

  return {
    title: fallbackTitle,
    detail:
      cleaned && cleaned.length < 220
        ? cleaned
        : "Something unexpected happened while connecting to your Worker.",
    fix: "Check the Worker URL and admin token from your Wrangler deploy, then try again.",
    links: installLinks,
  };
}

/**
 * Error explainer for the Cloudflare OAuth (install token) flow. Intentionally
 * does NOT attach the legacy manual-install links ("Download Worker install
 * ZIP", "Open install setup") or the "Admin token was rejected" messaging —
 * those belong to the deprecated paste-a-token flow, not OAuth. Produces a
 * clean, OAuth-specific message.
 */
export function explainCfOAuthError(
  err: unknown,
  fallbackTitle = "Cloudflare connection failed",
): DesktopErrorHelp {
  const raw = formatDesktopError(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("could not reach relaybase console") ||
    lower.includes("could not reach the relaybase console") ||
    lower.includes("error sending request") ||
    lower.includes("timed out") ||
    lower.includes("dns")
  ) {
    return {
      title: "Could not reach the Relaybase console",
      detail:
        "Relaybase could not contact console.relaybase.xyz to start the Cloudflare connection. Check your internet connection and try again.",
      fix: "If the problem persists, the console may be briefly unavailable.",
    };
  }

  if (
    lower.includes("oauth config") ||
    lower.includes("clientid") ||
    lower.includes("client secret") ||
    lower.includes("oauth client not configured")
  ) {
    return {
      title: "Cloudflare OAuth isn't configured yet",
      detail:
        "The Relaybase console hasn't been set up with a Cloudflare OAuth client. Connecting won't work until that's done.",
      fix: "This is usually resolved shortly after a Relaybase update. Try again later, or contact Relaybase if it persists.",
    };
  }

  if (
    lower.includes("32831") ||
    lower.includes("already in use") ||
    lower.includes("callback port")
  ) {
    return {
      title: "Another Relaybase is using the callback port",
      detail:
        "Cloudflare returns to 127.0.0.1:32831. The installed Relaybase.app (or another window) is already listening there, so this window never sees the authorization.",
      fix: "Quit Relaybase.app in Applications, then click Authorize again in this window.",
    };
  }

  if (lower.includes("state does not match") || lower.includes("oauth state")) {
    return {
      title: "Cloudflare connection didn't complete",
      detail:
        "The Cloudflare callback didn't match the connection you started here. This can happen if you have an old link open.",
      fix: "Click Connect with Cloudflare again and approve in the browser window that opens.",
    };
  }

  if (
    lower.includes("access_denied") ||
    lower.includes("access denied") ||
    lower.includes("user denied") ||
    lower.includes("authorization denied")
  ) {
    return oauthAuthorizationIncompleteHelp("cancelled");
  }

  if (lower.includes("missing tokens") || lower.includes("token exchange failed")) {
    return {
      title: "Cloudflare didn't return a token",
      detail:
        "Cloudflare authorized the request but didn't return an access token to Relaybase.",
      fix: "Try Connect with Cloudflare again. If it keeps happening, the OAuth client may be misconfigured on the Relaybase side.",
    };
  }

  const cleaned = stripRawApiNoise(raw);
  return {
    title: fallbackTitle,
    detail:
      cleaned && cleaned.length < 220
        ? cleaned
        : "Something went wrong while connecting to Cloudflare.",
    fix: "Click Connect with Cloudflare again. If it keeps happening, try reconnecting from a clean state.",
  };
}

export async function desktopGetInfo(): Promise<{ isDesktop: boolean; version: string }> {
  return invoke("get_desktop_info");
}

export async function desktopGetCredentials(): Promise<DesktopCredentials | null> {
  return invoke("get_credentials");
}

export async function desktopSaveCfCredentials(
  accountId: string,
  installToken: string,
  serverToken: string,
): Promise<DesktopCredentials> {
  return invoke("save_cf_credentials", { accountId, installToken, serverToken });
}

export async function desktopVerifyCfToken(
  accountId: string,
  apiToken: string,
  scope: "install" | "server",
): Promise<{ ok: boolean; accountId: string; message: string }> {
  return invoke("verify_cf_token", { accountId, apiToken, scope });
}

/** Push the saved server token to the Worker as `CF_API_TOKEN` via the Cloudflare API. */
export async function desktopPushServerToken(): Promise<{
  ok: boolean;
  message: string;
  pushedAt: string;
}> {
  return invoke("push_server_token");
}

// --- Cloudflare OAuth (install token) ---
// The install token is obtained via a CF OAuth authorization-code + refresh
// flow whose callback lives on console.relaybase.xyz. The desktop opens the
// authorize URL in the system browser; the console exchanges the code and
// redirects the browser to a `relaybase://oauth/callback` deep link carrying
// the tokens. The frontend listens for that deep link (see
// `listenCfOAuthDeepLink`) and hands the tokens to `complete_cf_oauth`,
// which stores them in Tauri process memory only. Refresh is handled
// transparently by the Rust side before any wrangler/CF-API call.

export async function desktopStartCfOAuth(): Promise<{
  authorizeUrl: string;
  state: string;
}> {
  return invoke("start_cf_oauth");
}

export type CfOAuthDeepLinkCallback = {
  state: string;
  code: string;
};

/** Parse a `relaybase://oauth/callback?...` URL into the code + state payload. */
export function parseCfOAuthDeepLink(url: string): CfOAuthDeepLinkCallback | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "relaybase:" || u.host !== "oauth" || u.pathname !== "/callback") {
      return null;
    }
    const state = u.searchParams.get("state") ?? "";
    const code = u.searchParams.get("code") ?? "";
    if (!state || !code) return null;
    return { state, code };
  } catch {
    return null;
  }
}

/**
 * Subscribe to the CF OAuth deep link. Calls `handler` with the parsed
 * { state, code } whenever a `relaybase://oauth/callback` URL opens the app
 * (either on launch via `getCurrent`, or while running via `onOpenUrl`).
 * Returns an unsubscribe function (no-op outside Tauri).
 */
export async function listenCfOAuthDeepLink(
  handler: (cb: CfOAuthDeepLinkCallback) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {
      /* no-op outside Tauri */
    };
  }
  try {
    const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
    const dispatch = (urls: string[] | null) => {
      if (!urls) return;
      for (const u of urls) {
        const parsed = parseCfOAuthDeepLink(u);
        if (parsed) handler(parsed);
      }
    };
    // App may have been launched by the deep link (cold start).
    dispatch(await getCurrent());
    // Subsequent links while running.
    const unlisten = await onOpenUrl(dispatch);
    return () => {
      try {
        unlisten();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {
      /* plugin not available */
    };
  }
}

/** Complete the CF OAuth flow from a deep-link payload: validate state and
 * exchange the code (the desktop holds the PKCE verifier). Returns the
 * updated credentials. */
export async function desktopCompleteCfOAuth(
  cb: CfOAuthDeepLinkCallback,
): Promise<DesktopCredentials> {
  return invoke("complete_cf_oauth", {
    state: cb.state,
    code: cb.code,
  });
}

/**
 * Listen for Rust-completed CF OAuth (loopback http://127.0.0.1:32831 or
 * `relaybase://` deep link). Prefer this over `listenCfOAuthDeepLink` — the
 * desktop completes the exchange itself so Settings does not have to.
 */
export async function listenCfOAuthResult(handler: {
  onComplete: () => void;
  onError: (message: string) => void;
}): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {
      /* no-op */
    };
  }
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unOk = await listen<{ ok?: boolean }>("cf-oauth-complete", () => {
      handler.onComplete();
    });
    const unErr = await listen<{ error?: string }>("cf-oauth-error", (e) => {
      handler.onError(
        typeof e.payload?.error === "string" && e.payload.error.trim()
          ? e.payload.error
          : "Cloudflare connection failed",
      );
    });
    return () => {
      unOk();
      unErr();
    };
  } catch {
    return () => {
      /* plugin not available */
    };
  }
}

/** Force a refresh of the OAuth access token (rarely needed; the Rust side
 * refreshes automatically before wrangler/CF-API calls). Returns the updated
 * credentials. */
export async function desktopRefreshInstallToken(): Promise<DesktopCredentials> {
  return invoke("refresh_install_token");
}

export async function desktopListZones(): Promise<ZoneSummary[]> {
  return invoke("list_cf_zones");
}

export async function desktopProbeWorker(): Promise<ProbeResult> {
  return invoke("probe_routing_worker");
}

export async function desktopAdoptWorker(): Promise<InstallResult> {
  return invoke("adopt_routing_worker");
}

export async function desktopInstallWorker(
  workerJs?: string,
): Promise<InstallResult> {
  return invoke("install_routing_worker", { workerJs: workerJs ?? null });
}

/**
 * Background auto-install of the routing Worker into the user's Cloudflare
 * account via the Cloudflare HTTP API. Auth is the in-memory OAuth session.
 */
export async function desktopProbeInstall(
  accountId?: string,
): Promise<InstallProbeResult> {
  return invoke("probe_auto_install", {
    accountId: accountId ?? null,
  });
}

export async function desktopAutoInstallWorker(
  accountId?: string,
  serverToken?: string,
  decisions?: InstallDecision[],
  wipeConfirmation?: string | null,
): Promise<AutoInstallResult> {
  return invoke("auto_install_routing_worker", {
    accountId: accountId ?? null,
    serverToken: serverToken?.trim() ? serverToken.trim() : null,
    decisions: decisions ?? [],
    wipeConfirmation: wipeConfirmation?.trim() ? wipeConfirmation.trim() : null,
  });
}

/** Compare stored Worker version against relaybase.xyz install manifest. */
export async function desktopCheckWorkerUpdate(): Promise<WorkerUpdateCheck> {
  return invoke("check_worker_update_cmd");
}

/** Download latest install ZIP and re-deploy the Worker (keeps ADMIN_TOKEN + D1). */
export async function desktopUpdateInstalledWorker(
  serverToken?: string,
): Promise<AutoInstallResult> {
  return invoke("update_installed_worker_cmd", {
    serverToken: serverToken?.trim() ? serverToken.trim() : null,
  });
}

/** Stop an in-flight auto-install. The install promise then rejects. */
export async function desktopCancelAutoInstall(): Promise<void> {
  await invoke("cancel_auto_install");
}

/** Delete Worker + D1 + R2. Subscribe to `install-log` for the same live log as install. */
export async function desktopRollbackInstall(
  accountId?: string,
  wipeConfirmation?: string | null,
): Promise<void> {
  await invoke("rollback_auto_install", {
    accountId: accountId ?? null,
    wipeConfirmation: wipeConfirmation?.trim() ? wipeConfirmation.trim() : null,
  });
}

/** Call the deployed Worker's POST /console/init-db to initialize or clear D1. */
export async function desktopInitWorkerDb(
  workerUrl: string,
  adminToken: string,
  clear: boolean,
  wipeConfirmation?: string | null,
  accountId?: string,
): Promise<InitDbResult> {
  return invoke("init_worker_db_cmd", {
    workerUrl,
    adminToken,
    clear,
    wipeConfirmation: wipeConfirmation?.trim() ? wipeConfirmation.trim() : null,
    accountId: accountId?.trim() ? accountId.trim() : null,
  });
}

export function isInstallCancelledError(err: unknown): boolean {
  return formatDesktopError(err).includes("INSTALL_CANCELLED");
}

/** Subscribe to `install-log` events emitted during auto-install. */
export async function listenInstallLog(
  handler: (event: InstallLogEvent) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {
      /* no-op outside Tauri */
    };
  }
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen("install-log", (e) => handler(e.payload as InstallLogEvent));
  } catch {
    return () => {
      /* no-op */
    };
  }
}

export async function desktopUpdateWorker(
  workerJs?: string,
): Promise<InstallResult> {
  return invoke("update_routing_worker", { workerJs: workerJs ?? null });
}

export async function desktopSaveLicense(licenseKey: string): Promise<void> {
  return invoke("save_license_key", { licenseKey });
}

export async function desktopSaveRelaybaseAccount(input: {
  accountId: string;
  email: string;
  session: string;
  tier?: string;
}): Promise<DesktopCredentials> {
  if (isDesktopRuntime()) {
    return invoke("save_relaybase_account", {
      accountId: input.accountId,
      email: input.email,
      session: input.session,
      tier: input.tier ?? null,
    });
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId: existing?.accountId ?? "",
    installToken: existing?.installToken ?? "",
    serverToken: existing?.serverToken ?? "",
    serverTokenPushedAt: existing?.serverTokenPushedAt ?? "",
    workerUrl: existing?.workerUrl ?? "",
    adminToken: existing?.adminToken ?? "",
    workerScriptName: existing?.workerScriptName ?? "",
    workerVersion: existing?.workerVersion ?? "",
    licenseKey: existing?.licenseKey ?? "",
    relaybaseAccountId: input.accountId,
    relaybaseEmail: input.email,
    relaybaseSession: input.session,
    relaybaseTier: input.tier ?? "",
    cfOauthAccessToken: existing?.cfOauthAccessToken ?? "",
    cfOauthRefreshToken: existing?.cfOauthRefreshToken ?? "",
    cfOauthAccessExpiresAt: existing?.cfOauthAccessExpiresAt ?? "",
    cfOauthAccountId: existing?.cfOauthAccountId ?? "",
  };
  const res = await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) throw new Error("Failed to save Relaybase account to ~/.relaybase");
  return next;
}

export type DesktopTeamLogin = {
  workerUrl: string;
  accountEmail: string;
  mobilePassword: string;
};

export async function desktopGetTeamLogin(): Promise<DesktopTeamLogin | null> {
  if (isDesktopRuntime()) {
    return invoke("get_team_login");
  }
  return null;
}

export async function desktopSaveTeamLogin(input: {
  workerUrl: string;
  accountEmail: string;
  mobilePassword: string;
}): Promise<DesktopTeamLogin> {
  if (isDesktopRuntime()) {
    return invoke("save_team_login_cmd", {
      workerUrl: input.workerUrl,
      accountEmail: input.accountEmail,
      mobilePassword: input.mobilePassword,
    });
  }
  return {
    workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
    accountEmail: input.accountEmail.trim().toLowerCase(),
    mobilePassword: input.mobilePassword,
  };
}

export async function desktopClearTeamLogin(): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("clear_team_login_cmd");
  }
}

export async function desktopClearRelaybaseAccount(): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("clear_relaybase_account");
    return;
  }
  const existing = await loadLocalCredentialsFile();
  if (!existing) return;
  const next: DesktopCredentials = {
    ...existing,
    relaybaseAccountId: "",
    relaybaseEmail: "",
    relaybaseSession: "",
    relaybaseTier: "",
  };
  await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
}

const CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.relaybase.xyz";

/**
 * Register the customer Worker URL with the Relaybase console so the account
 * ↔ Worker mapping is known for recovery. Requires a Relaybase account
 * session (relaybaseSession in credentials). No-op if not signed in.
 */
export async function desktopRegisterWorkerWithConsole(
  workerUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = isDesktopRuntime()
    ? await desktopGetCredentials()
    : await loadLocalCredentialsFile();
  const session = existing?.relaybaseSession?.trim() ?? "";
  if (!session) {
    return { ok: false, error: "Not signed in to Relaybase" };
  }
  const res = await fetch(
    `${CONSOLE_URL.replace(/\/$/, "")}/api/v1/account?action=worker/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
      },
      body: JSON.stringify({ workerUrl }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: Boolean(data.ok), error: data.error };
}

/**
 * Request a one-time ADMIN_TOKEN recovery token from the Relaybase console.
 * The token is emailed to the account owner (returned inline in dev).
 * Requires a Relaybase account session.
 */
export async function desktopRequestAdminRecoveryToken(): Promise<{
  ok: boolean;
  devToken?: string;
  error?: string;
}> {
  const existing = isDesktopRuntime()
    ? await desktopGetCredentials()
    : await loadLocalCredentialsFile();
  const session = existing?.relaybaseSession?.trim() ?? "";
  if (!session) {
    return { ok: false, error: "Not signed in to Relaybase" };
  }
  const res = await fetch(
    `${CONSOLE_URL.replace(/\/$/, "")}/api/v1/account?action=recovery-token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
      },
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    devToken?: string;
    error?: string;
  };
  return { ok: Boolean(data.ok), devToken: data.devToken, error: data.error };
}

/**
 * Reset the customer Worker's ADMIN_TOKEN using a recovery token issued by
 * the Relaybase console. The Worker verifies the token with the console and
 * then stores the new admin token in D1 (no wrangler needed).
 */
export async function desktopRecoverAdminToken(input: {
  workerUrl: string;
  accountEmail: string;
  recoveryToken: string;
  newAdminToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    `${input.workerUrl.replace(/\/$/, "")}/console/recover-admin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recoveryToken: input.recoveryToken,
        newAdminToken: input.newAdminToken,
        accountEmail: input.accountEmail,
        workerUrl: input.workerUrl,
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function desktopVerifyWorkerConnection(
  workerUrl: string,
  adminToken: string,
): Promise<WorkerConnectResult> {
  if (isDesktopRuntime()) {
    return invoke("verify_worker_connection", { workerUrl, adminToken });
  }
  const base = workerUrl.replace(/\/$/, "");
  const connect = await fetch(`${base}/console/connect`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!connect.ok) {
    throw new Error(
      connect.status === 401 || connect.status === 403
        ? "Admin token rejected by Worker"
        : `Worker connect failed (${connect.status})`,
    );
  }
  const value = (await connect.json().catch(() => ({}))) as {
    version?: string;
    workerScriptName?: string;
    accountId?: string;
    inbound?: {
      r2Configured?: boolean;
      bucketName?: string;
      usage?: {
        totalBytes?: number;
        objectCount?: number;
        truncated?: boolean;
      };
    };
    d1?: Parameters<typeof d1BindingFromPayload>[0];
    cfApiTokenSet?: boolean;
  };
  const usage = value.inbound?.usage;
  let d1Logs = d1BindingFromPayload(value.d1, "logs");
  let d1InboxIndex = d1BindingFromPayload(value.d1, "inboxIndex");
  let d1App = d1BindingFromPayload(value.d1, "app");

  if (
    !value.d1 ||
    (!d1Logs.configured &&
      !d1InboxIndex.configured &&
      !value.d1.logs &&
      !value.d1.inboxIndex)
  ) {
    const fallback = await probeD1WhenConnectOmits(base, adminToken);
    if (fallback.d1Logs.configured || fallback.d1InboxIndex.configured) {
      d1Logs = fallback.d1Logs;
      d1InboxIndex = fallback.d1InboxIndex;
    }
  }

  return {
    ok: true,
    product: "relaybase",
    version: value.version?.trim() || "unknown",
    workerScriptName: value.workerScriptName ?? "relaybase-api",
    workerUrl: base,
    accountId: value.accountId?.trim() ?? "",
    r2Configured: Boolean(value.inbound?.r2Configured),
    inboundBucketName: value.inbound?.bucketName ?? "",
    r2TotalBytes: usage?.totalBytes ?? null,
    r2ObjectCount: usage?.objectCount ?? null,
    r2UsageTruncated: usage?.truncated ?? null,
    cfApiTokenSet: Boolean(value.cfApiTokenSet),
    d1Logs,
    d1InboxIndex,
    d1App,
  };
}

export async function desktopSaveWorkerConnection(input: {
  workerUrl: string;
  adminToken: string;
  workerScriptName?: string;
  workerVersion?: string;
}): Promise<DesktopCredentials> {
  if (isDesktopRuntime()) {
    return invoke("save_worker_connection", {
      workerUrl: input.workerUrl,
      adminToken: input.adminToken,
      workerScriptName: input.workerScriptName ?? null,
      workerVersion: input.workerVersion?.trim() ? input.workerVersion.trim() : null,
    });
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId: existing?.accountId ?? "",
    installToken: existing?.installToken ?? "",
    serverToken: existing?.serverToken ?? "",
    serverTokenPushedAt: existing?.serverTokenPushedAt ?? "",
    workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
    adminToken: input.adminToken.trim(),
    workerScriptName:
      input.workerScriptName?.trim() || existing?.workerScriptName || "",
    workerVersion:
      input.workerVersion?.trim() || existing?.workerVersion || "",
    licenseKey: existing?.licenseKey ?? "",
    relaybaseAccountId: existing?.relaybaseAccountId ?? "",
    relaybaseEmail: existing?.relaybaseEmail ?? "",
    relaybaseSession: existing?.relaybaseSession ?? "",
    relaybaseTier: existing?.relaybaseTier ?? "",
    cfOauthAccessToken: existing?.cfOauthAccessToken ?? "",
    cfOauthRefreshToken: existing?.cfOauthRefreshToken ?? "",
    cfOauthAccessExpiresAt: existing?.cfOauthAccessExpiresAt ?? "",
    cfOauthAccountId: existing?.cfOauthAccountId ?? "",
  };
  const res = await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) {
    throw new Error("Failed to save credentials to ~/.relaybase");
  }
  return next;
}

export async function desktopClearCredentials(): Promise<void> {
  if (isDesktopRuntime()) {
    return invoke("clear_stored_credentials");
  }
  await fetch("/api/local-credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: "",
      installToken: "",
      serverToken: "",
      serverTokenPushedAt: "",
      workerUrl: "",
      adminToken: "",
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
    }),
  });
}

async function loadLocalCredentialsFile(): Promise<DesktopCredentials | null> {
  try {
    const res = await fetch("/api/local-credentials", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DesktopCredentials | null;
  } catch {
    return null;
  }
}

export type DesktopEmailPrefs = {
  version: number;
  accountColors: Record<string, string>;
  signatures?: Record<string, string>;
};

export async function desktopGetEmailPrefs(): Promise<DesktopEmailPrefs | null> {
  return invoke("get_email_prefs");
}

export async function desktopSaveEmailPrefs(
  prefs: DesktopEmailPrefs,
): Promise<void> {
  return invoke("save_email_prefs", { prefs });
}

/** Read JSON from `~/.relaybase/mail/{relativePath}`. */
export async function desktopGetMailJson(
  relativePath: string,
): Promise<unknown | null> {
  return invoke("get_mail_json", { relativePath });
}

/** Write JSON to `~/.relaybase/mail/{relativePath}`. */
export async function desktopSaveMailJson(
  relativePath: string,
  value: unknown,
): Promise<void> {
  return invoke("save_mail_json", { relativePath, value });
}

/** Read JSON from `~/.relaybase/cache/{relativePath}`. */
export async function desktopGetCacheJson(
  relativePath: string,
): Promise<unknown | null> {
  return invoke("get_cache_json", { relativePath });
}

/** Write JSON to `~/.relaybase/cache/{relativePath}`. */
export async function desktopSaveCacheJson(
  relativePath: string,
  value: unknown,
): Promise<void> {
  return invoke("save_cache_json", { relativePath, value });
}

/** Open an https URL in the system browser (required inside Tauri webview). */
export async function desktopOpenExternal(url: string): Promise<void> {
  if (!isDesktopRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external_url", { url });
}

/**
 * Open an attachment with the OS default application. The frontend base64-encodes
 * the attachment bytes (already fetched via the authenticated blob URL) and the
 * Rust side decodes, writes a temp file with the original extension, and hands it
 * to the OS opener (Preview / Acrobat / Photos). Desktop-only.
 */
export async function desktopOpenAttachment(
  filename: string,
  data: Uint8Array,
): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopOpenAttachment is only available in the desktop app");
  }
  const base64 = bytesToBase64(data);
  return invoke("open_local_file_with_default_app", {
    name: filename,
    base64Data: base64,
  });
}

/** Save a file to the user's Downloads folder (desktop only). Returns the saved path. */
export async function desktopSaveDownloadFile(
  filename: string,
  data: Uint8Array,
): Promise<string> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopSaveDownloadFile is only available in the desktop app");
  }
  const base64 = bytesToBase64(data);
  return invoke("save_download_file", {
    name: filename,
    base64Data: base64,
  });
}

/** Open a local file with the OS default application (desktop only). */
export async function desktopOpenFilePath(path: string): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopOpenFilePath is only available in the desktop app");
  }
  return invoke("open_file_path", { path });
}

/** Reveal a file in the system file manager (desktop only). */
export async function desktopRevealFileInFolder(path: string): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("desktopRevealFileInFolder is only available in the desktop app");
  }
  return invoke("reveal_file_in_folder", { path });
}

/** Chunk-aware base64 encoder (avoids `String.fromCharCode(...largeArray)` stack limit). */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export type DesktopApiKeyVaultEntry = {
  id: string;
  domain: string;
  label: string | null;
  apiKey: string;
  createdAt: string;
};

export type DesktopApiKeyVault = {
  version: number;
  entries: DesktopApiKeyVaultEntry[];
};

export async function desktopGetApiKeyVault(): Promise<DesktopApiKeyVault> {
  if (!isDesktopRuntime()) {
    return loadBrowserApiKeyVault();
  }
  return invoke("get_api_key_vault");
}

export async function desktopSaveApiKeyVaultEntry(
  entry: DesktopApiKeyVaultEntry,
): Promise<DesktopApiKeyVault> {
  if (!isDesktopRuntime()) {
    const vault = loadBrowserApiKeyVault();
    const next = {
      version: 1,
      entries: [
        entry,
        ...vault.entries.filter((e) => e.id !== entry.id),
      ],
    };
    saveBrowserApiKeyVault(next);
    return next;
  }
  return invoke("save_api_key_vault_entry", { entry });
}

export async function desktopRemoveApiKeyVaultEntry(
  id: string,
): Promise<DesktopApiKeyVault> {
  if (!isDesktopRuntime()) {
    const vault = loadBrowserApiKeyVault();
    const next = {
      version: 1,
      entries: vault.entries.filter((e) => e.id !== id),
    };
    saveBrowserApiKeyVault(next);
    return next;
  }
  return invoke("remove_api_key_vault_entry_cmd", { id });
}

/** One-shot mail/{oldCookieUser} → mail/desktop rename. */
export async function desktopMigrateMailUserFolder(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return invoke("migrate_mail_user_folder");
}

/** Opaque account-scope id (`s-{16hex}`) for the current session. */
export async function desktopGetAccountScopeId(): Promise<string> {
  if (!isDesktopRuntime()) return "s-legacy";
  return invoke("get_account_scope_id");
}

/** One-shot flat→scoped layout migration. Idempotent. */
export async function desktopMigrateStorageLayout(): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("migrate_storage_layout");
}

const BROWSER_API_KEY_VAULT = "relaybase:api-keys-vault:v1";

function loadBrowserApiKeyVault(): DesktopApiKeyVault {
  if (typeof window === "undefined") return { version: 1, entries: [] };
  try {
    const raw = localStorage.getItem(BROWSER_API_KEY_VAULT);
    if (!raw) return { version: 1, entries: [] };
    const parsed = JSON.parse(raw) as DesktopApiKeyVault;
    return {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function saveBrowserApiKeyVault(vault: DesktopApiKeyVault) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROWSER_API_KEY_VAULT, JSON.stringify(vault));
  } catch {
    /* ignore */
  }
}
