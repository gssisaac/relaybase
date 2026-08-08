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

/** Hosted install ZIP (packed via `pnpm pack:worker-install`). */
export const WORKER_INSTALL_ZIP_URL =
  process.env.NEXT_PUBLIC_WORKER_INSTALL_ZIP_URL ??
  "https://relaybase.xyz/downloads/relaybase-worker-install.zip";

/** Exact Cloudflare API token scopes — only if a future optional Zone-assist feature needs them. */
export const CF_REQUIRED_TOKEN_PERMISSIONS = [
  "Account — Workers Scripts — Edit",
  "Account — Workers KV Storage — Edit",
  "Account — Workers R2 Storage — Edit",
  "Account — Email Sending — Edit",
  "Zone — Email Routing Rules — Edit",
  "Zone — Zone — Read",
] as const;

export type WorkerConnectResult = {
  ok: boolean;
  product: string;
  workerScriptName: string;
  workerUrl: string;
  r2Configured: boolean;
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
    lower.includes("does not look like a relaybase") ||
    lower.includes("not with a relaybase connect") ||
    lower.includes("connect check failed")
  ) {
    return {
      title: "Not a Relaybase Worker",
      detail:
        "The URL is reachable but did not return a Relaybase connect response.",
      fix: "Deploy the official install ZIP (`relaybase-api`), then paste the workers.dev URL from Wrangler.",
      links: installLinks,
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

  const cleaned = stripRawApiNoise(raw);
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

export async function desktopVerifyWorkerConnection(
  workerUrl: string,
  adminToken: string,
): Promise<WorkerConnectResult> {
  return invoke("verify_worker_connection", { workerUrl, adminToken });
}

export async function desktopSaveWorkerConnection(input: {
  workerUrl: string;
  adminToken: string;
  workerScriptName?: string;
}): Promise<DesktopCredentials> {
  return invoke("save_worker_connection", {
    workerUrl: input.workerUrl,
    adminToken: input.adminToken,
    workerScriptName: input.workerScriptName ?? null,
  });
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
