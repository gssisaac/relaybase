"use client";

export type DesktopCredentials = {
  accountId: string;
  apiToken: string;
  workerUrl: string;
  adminToken: string;
  workerScriptName: string;
  licenseKey: string;
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
  keysKvId: string;
  apiKvId: string;
  r2Bucket: string;
  skipped: boolean;
  adminRelinked: boolean;
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

/** Exact Cloudflare API token scopes Relaybase needs. */
export const CF_REQUIRED_TOKEN_PERMISSIONS = [
  "Account — Workers Scripts — Edit",
  "Account — Workers KV Storage — Edit",
  "Account — Workers R2 Storage — Edit",
  "Account — Email Sending — Edit",
  "Zone — Email Routing Rules — Edit",
  "Zone — Zone — Read",
] as const;

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
): DesktopErrorHelp {
  const raw = formatDesktopError(err);
  const lower = raw.toLowerCase();
  const tokenLinks: DesktopErrorLink[] = [
    { label: "Open Cloudflare API tokens", href: CF_API_TOKENS_URL },
    { label: "Back to Connect Cloudflare", href: "/setup/connect" },
  ];

  if (
    lower.includes("~/.relaybase") ||
    lower.includes(".relaybase") ||
    lower.includes("credentials.json") ||
    lower.includes("could not resolve home")
  ) {
    return {
      title: "Could not save credentials on this Mac",
      detail:
        "Relaybase could not read or write ~/.relaybase/credentials.json.",
      fix: "Make sure your home folder is writable, then try again. To reset, delete that file and reconnect.",
    };
  }

  if (
    lower.includes("connect cloudflare first") ||
    lower.includes("no credentials")
  ) {
    return {
      title: "Cloudflare is not connected yet",
      detail: "Account ID and API token are missing from this app.",
      fix: "Connect Cloudflare first, verify the token, then return here.",
      links: [
        { label: "Go to Connect Cloudflare", href: "/setup/connect" },
        { label: "Open Cloudflare API tokens", href: CF_API_TOKENS_URL },
      ],
    };
  }

  if (
    lower.includes("authentication error") ||
    lower.includes("invalid access token") ||
    lower.includes("code\":10000") ||
    lower.includes('code": 10000') ||
    lower.includes("unauthorized") ||
    lower.includes("status: 401") ||
    lower.includes("(401)") ||
    (lower.includes("403") && lower.includes("forbidden"))
  ) {
    return {
      title: "Cloudflare API token was rejected",
      detail:
        "The saved token is invalid, expired, revoked, or does not match this Account ID. Create a Custom token with the permissions below (Account Resources = this account, Zone Resources = All zones or the zones you use).",
      fix: "Open the API tokens page, create a new token with every permission listed, then paste it on Connect Cloudflare and verify again.",
      links: tokenLinks,
      permissions: CF_REQUIRED_TOKEN_PERMISSIONS,
    };
  }

  if (
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("insufficient") ||
    lower.includes("does not have permission")
  ) {
    return {
      title: "Token is missing a required permission",
      detail:
        "The token authenticated, but it cannot manage Workers, KV, R2, or Email for this account. Edit the token (or create a new one) and grant every permission below.",
      fix: "Update the token scopes in Cloudflare, reconnect on Connect Cloudflare, then tap Re-check.",
      links: tokenLinks,
      permissions: CF_REQUIRED_TOKEN_PERMISSIONS,
    };
  }

  if (lower.includes("cloudflare api error") || lower.includes("workers/scripts")) {
    return {
      title: "Cloudflare request failed",
      detail:
        "Relaybase could not complete a Cloudflare API call. Often this is a wrong Account ID, inactive token, or missing permission from the list below.",
      fix: "Confirm Account ID + token, ensure all permissions below are granted, reconnect, then Re-check.",
      links: tokenLinks,
      permissions: CF_REQUIRED_TOKEN_PERMISSIONS,
    };
  }

  if (
    lower.includes("network") ||
    lower.includes("dns") ||
    lower.includes("timed out") ||
    lower.includes("error sending request")
  ) {
    return {
      title: "Network request failed",
      detail: "This Mac could not reach Cloudflare.",
      fix: "Check your internet connection, then tap Re-check.",
    };
  }

  const cleaned = stripRawApiNoise(raw);
  return {
    title: fallbackTitle,
    detail:
      cleaned && cleaned.length < 220
        ? cleaned
        : "Something unexpected happened while talking to Cloudflare or this app.",
    fix: "Fix the issue below, then try again. If the token looks wrong, reconnect Cloudflare with a fresh token.",
    links: tokenLinks,
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
  apiToken: string,
): Promise<DesktopCredentials> {
  return invoke("save_cf_credentials", { accountId, apiToken });
}

export async function desktopVerifyCfToken(
  accountId: string,
  apiToken: string,
): Promise<{ ok: boolean; accountId: string; message: string }> {
  return invoke("verify_cf_token", { accountId, apiToken });
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

export async function desktopUpdateWorker(
  workerJs?: string,
): Promise<InstallResult> {
  return invoke("update_routing_worker", { workerJs: workerJs ?? null });
}

export async function desktopSaveLicense(licenseKey: string): Promise<void> {
  return invoke("save_license_key", { licenseKey });
}

export async function desktopClearCredentials(): Promise<void> {
  return invoke("clear_stored_credentials");
}

/** Open an https URL in the system browser (required inside Tauri webview). */
export async function desktopOpenExternal(url: string): Promise<void> {
  if (!isDesktopRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external_url", { url });
}
