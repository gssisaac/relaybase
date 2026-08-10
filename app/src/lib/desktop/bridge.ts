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

/**
 * Optional Cloudflare API token scopes for Zone / Email assist
 * (Domains import, routing automation). Not required for Worker self-install.
 */
export const CF_REQUIRED_TOKEN_PERMISSIONS = [
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
  inboundBucketName: string;
  /** Sum of inbound R2 object sizes in bytes, when the Worker reported usage. */
  r2TotalBytes?: number | null;
  r2ObjectCount?: number | null;
  /** True when the Worker stopped scanning early (large bucket). */
  r2UsageTruncated?: boolean | null;
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

// ---- In-app Wrangler deploy (v2) -------------------------------------------

export type DeployOpts = {
  enableD1Logs: boolean;
  rotateAdminToken: boolean;
};

export type DeployResult = {
  workerUrl: string;
  workerScriptName: string;
  adminToken: string;
  workerVersion: string;
  kvNamespaceId: string;
  r2Bucket: string;
  d1DatabaseId: string | null;
  migrationsApplied: string[];
  deployed: boolean;
};

export type DeployLogLine = {
  step: string;
  stream: "stdout" | "stderr";
  line: string;
};

export type DeployStatus = {
  step: string;
  state: "running" | "ok" | "failed";
  message: string;
};

export type KvHealthResult = {
  kvNamespaceId: string;
  srvConfigPresent: boolean;
  srvKeyPresent: boolean;
  ok: boolean;
};

export type WorkerVersionInfo = {
  ok: boolean;
  workerVersion: string;
  migrationsApplied: string[];
};

export type DesktopSettings = {
  version: number;
  autoRedeployOnUpdate: boolean;
  enableD1Logs: boolean;
};

export async function desktopGetDesktopSettings(): Promise<DesktopSettings> {
  return invoke("get_desktop_settings");
}

export async function desktopSaveDesktopSettings(
  settings: DesktopSettings,
): Promise<void> {
  return invoke("save_desktop_settings_cmd", { settings });
}

/** Run the full in-app deploy (extract → npm install → provision → deploy → secret → migrate). */
export async function desktopDeployWorker(
  opts: DeployOpts,
): Promise<DeployResult> {
  return invoke("deploy_routing_worker_v2", { opts });
}

/** Read-only KV key-prefix health check via wrangler. */
export async function desktopKvHealthCheck(): Promise<KvHealthResult> {
  return invoke("kv_health_check");
}

/** Bundled worker version (from the embedded install ZIP manifest). */
export async function desktopGetBundledWorkerVersion(): Promise<string> {
  return invoke("get_bundled_worker_version");
}

/** Probe the deployed Worker's /admin/version. Desktop + browser compatible. */
export async function desktopGetDeployedWorkerVersion(
  workerUrl: string,
  adminToken: string,
): Promise<WorkerVersionInfo> {
  const base = workerUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/admin/version`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) {
    throw new Error(`/admin/version returned HTTP ${res.status}`);
  }
  const value = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    workerVersion?: string;
    migrationsApplied?: string[];
  };
  return {
    ok: Boolean(value.ok),
    workerVersion: value.workerVersion ?? "",
    migrationsApplied: Array.isArray(value.migrationsApplied)
      ? value.migrationsApplied
      : [],
  };
}

type Unlisten = () => void;

/** Subscribe to deploy log lines (streaming stdout/stderr from wrangler). */
export async function desktopOnDeployLog(
  cb: (line: DeployLogLine) => void,
): Promise<Unlisten> {
  const { listen } = await import("@tauri-apps/api/event");
  return (await listen<DeployLogLine>("worker-deploy:log", (e) => cb(e.payload))) as Unlisten;
}

/** Subscribe to deploy step status updates. */
export async function desktopOnDeployStatus(
  cb: (status: DeployStatus) => void,
): Promise<Unlisten> {
  const { listen } = await import("@tauri-apps/api/event");
  return (await listen<DeployStatus>("worker-deploy:status", (e) =>
    cb(e.payload),
  )) as Unlisten;
}

export async function desktopSaveLicense(licenseKey: string): Promise<void> {
  return invoke("save_license_key", { licenseKey });
}

export async function desktopVerifyWorkerConnection(
  workerUrl: string,
  adminToken: string,
): Promise<WorkerConnectResult> {
  if (isDesktopRuntime()) {
    return invoke("verify_worker_connection", { workerUrl, adminToken });
  }
  const base = workerUrl.replace(/\/$/, "");
  const connect = await fetch(`${base}/admin/connect`, {
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
    workerScriptName?: string;
    inbound?: { r2Configured?: boolean; bucketName?: string };
  };
  return {
    ok: true,
    product: "relaybase",
    workerScriptName: value.workerScriptName ?? "relaybase-api",
    workerUrl: base,
    r2Configured: Boolean(value.inbound?.r2Configured),
    inboundBucketName: value.inbound?.bucketName ?? "",
  };
}

export async function desktopSaveWorkerConnection(input: {
  workerUrl: string;
  adminToken: string;
  workerScriptName?: string;
}): Promise<DesktopCredentials> {
  if (isDesktopRuntime()) {
    return invoke("save_worker_connection", {
      workerUrl: input.workerUrl,
      adminToken: input.adminToken,
      workerScriptName: input.workerScriptName ?? null,
    });
  }
  const existing = await loadLocalCredentialsFile();
  const next: DesktopCredentials = {
    accountId: existing?.accountId ?? "",
    apiToken: existing?.apiToken ?? "",
    workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
    adminToken: input.adminToken.trim(),
    workerScriptName:
      input.workerScriptName?.trim() || existing?.workerScriptName || "",
    licenseKey: existing?.licenseKey ?? "",
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
      apiToken: "",
      workerUrl: "",
      adminToken: "",
      workerScriptName: "",
      licenseKey: "",
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
