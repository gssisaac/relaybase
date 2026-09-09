import { formatDesktopError } from "./invoke";

export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";

export const GOOGLE_WORKSPACE_MIGRATION_DOC_URL =
  "https://relaybase.xyz/resources/google-workspace-coexistence-and-migration";

const GITHUB_WORKER_REPO = "strum-us/relaybase-worker";

/** Latest GitHub Release install ZIP (stable filename). */
export const WORKER_INSTALL_ZIP_URL =
  process.env.NEXT_PUBLIC_WORKER_INSTALL_ZIP_URL ??
  `https://github.com/${GITHUB_WORKER_REPO}/releases/latest/download/relaybase-worker-install.zip`;

/** Latest GitHub Release install manifest (version, zipUrl, sha256, workerJs). */
export const WORKER_INSTALL_MANIFEST_URL =
  process.env.NEXT_PUBLIC_WORKER_INSTALL_MANIFEST_URL ??
  `https://github.com/${GITHUB_WORKER_REPO}/releases/latest/download/worker-install-manifest.json`;

/** Versioned Worker script on a GitHub Release, e.g. worker.0.1.1.js */
export function workerJsReleaseUrl(version: string): string {
  const v = version.trim().replace(/^v/, "");
  return `https://github.com/${GITHUB_WORKER_REPO}/releases/download/v${v}/worker.${v}.js`;
}

type GithubReleaseAsset = { name?: string; browser_download_url?: string };
type GithubRelease = {
  tag_name?: string;
  published_at?: string;
  assets?: GithubReleaseAsset[];
};

/**
 * Resolve latest install metadata via the GitHub API (CORS-friendly).
 * Desktop Rust still downloads the ZIP from `WORKER_INSTALL_MANIFEST_URL`.
 */
export async function fetchWorkerInstallManifest(): Promise<WorkerInstallManifest | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_WORKER_REPO}/releases/latest`,
      {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as GithubRelease;
    const tag = (data.tag_name ?? "").trim().replace(/^v/, "");
    if (!tag) return null;
    const assets = data.assets ?? [];
    const zip =
      assets.find((a) => a.name === `relaybase-worker-install-${tag}.zip`) ??
      assets.find((a) => a.name === "relaybase-worker-install.zip");
    const js = assets.find((a) => a.name === `worker.${tag}.js`);
    const zipUrl =
      zip?.browser_download_url?.trim() ||
      `https://github.com/${GITHUB_WORKER_REPO}/releases/download/v${tag}/relaybase-worker-install-${tag}.zip`;
    return {
      version: tag,
      zipUrl,
      zipSha256: "",
      publishedAt: data.published_at ?? "",
      workerJs: `worker.${tag}.js`,
      workerJsUrl: js?.browser_download_url?.trim() || workerJsReleaseUrl(tag),
    };
  } catch {
    return null;
  }
}

export type WorkerInstallManifest = {
  version: string;
  zipUrl: string;
  zipSha256: string;
  publishedAt: string;
  /** Hosted / ZIP filename, e.g. `worker.0.1.1.js`. */
  workerJs?: string;
  /** Direct GitHub Release URL for `worker.{version}.js`. */
  workerJsUrl?: string;
  notes?: string;
};

export type WorkerUpdateCheck = {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion?: string | null;
  zipUrl?: string | null;
  zipSha256?: string | null;
};

export type CfTokenPermissionStatus =
  | "ok"
  | "missing"
  | "read_only"
  | "skipped"
  | "unknown";

export type CfApiTokenPermissions = {
  zoneRead: CfTokenPermissionStatus;
  emailRoutingRead: CfTokenPermissionStatus;
  emailRoutingEdit: CfTokenPermissionStatus;
  emailSendingEdit: CfTokenPermissionStatus;
  dnsEdit: CfTokenPermissionStatus;
};

export type CfTokenPermissionCheckId =
  | "emailRoutingRead"
  | "emailRoutingEdit"
  | "emailSendingEdit"
  | "zoneRead"
  | "dnsEdit";

export type CfTokenPermissionCheck = {
  id: CfTokenPermissionCheckId;
  category: "Zone" | "Account";
  name: "Email Routing" | "Email Routing Rules" | "Email Sending" | "Zone" | "DNS";
  requiredAccess: "Edit" | "Read";
  status: CfTokenPermissionStatus;
};

export const CF_TOKEN_PERMISSION_DEFS: readonly Omit<
  CfTokenPermissionCheck,
  "status"
>[] = [
  {
    id: "emailRoutingRead",
    category: "Zone",
    name: "Email Routing",
    requiredAccess: "Read",
  },
  {
    id: "emailRoutingEdit",
    category: "Zone",
    name: "Email Routing Rules",
    requiredAccess: "Edit",
  },
  {
    id: "emailSendingEdit",
    category: "Account",
    name: "Email Sending",
    requiredAccess: "Edit",
  },
  {
    id: "zoneRead",
    category: "Zone",
    name: "Zone",
    requiredAccess: "Read",
  },
  {
    id: "dnsEdit",
    category: "Zone",
    name: "DNS",
    requiredAccess: "Edit",
  },
] as const;

/**
 * Optional Cloudflare API token scopes for Zone / Email Routing assist
 * (Domains import, routing automation, DMARC DNS). Not required for Worker self-install.
 */
export const CF_REQUIRED_TOKEN_PERMISSIONS = CF_TOKEN_PERMISSION_DEFS.map(
  (row) => `${row.category} — ${row.name} — ${row.requiredAccess}`,
);

const CF_TOKEN_PERMISSION_STATUSES = new Set<CfTokenPermissionStatus>([
  "ok",
  "missing",
  "read_only",
  "skipped",
  "unknown",
]);

function asCfTokenPermissionStatus(value: unknown): CfTokenPermissionStatus {
  return typeof value === "string" &&
    CF_TOKEN_PERMISSION_STATUSES.has(value as CfTokenPermissionStatus)
    ? (value as CfTokenPermissionStatus)
    : "unknown";
}

export function parseCfApiTokenPermissions(
  value: unknown,
): CfApiTokenPermissions | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (
    !("zoneRead" in raw) &&
    !("emailRoutingRead" in raw) &&
    !("emailRoutingEdit" in raw) &&
    !("emailSendingEdit" in raw) &&
    !("dnsEdit" in raw)
  ) {
    return undefined;
  }
  return {
    zoneRead: asCfTokenPermissionStatus(raw.zoneRead),
    emailRoutingRead: asCfTokenPermissionStatus(raw.emailRoutingRead),
    emailRoutingEdit: asCfTokenPermissionStatus(raw.emailRoutingEdit),
    emailSendingEdit: asCfTokenPermissionStatus(raw.emailSendingEdit),
    dnsEdit: asCfTokenPermissionStatus(raw.dnsEdit),
  };
}

export function cfTokenPermissionChecks(
  probe?: CfApiTokenPermissions | null,
): CfTokenPermissionCheck[] {
  return CF_TOKEN_PERMISSION_DEFS.map((row) => ({
    ...row,
    status: probe ? probe[row.id] : "unknown",
  }));
}

export function isCfTokenPermissionFailure(
  status: CfTokenPermissionStatus,
): boolean {
  return status === "missing" || status === "read_only";
}

/** Third-column label for permission error rows (e.g. Read → Edit, Missing → Edit). */
export function formatCfTokenAccessFix(check: CfTokenPermissionCheck): string {
  if (check.status === "read_only") {
    return `Read → ${check.requiredAccess}`;
  }
  if (check.status === "missing") {
    return `Missing → ${check.requiredAccess}`;
  }
  return check.requiredAccess;
}

export function describeCfTokenPermissionFailure(
  check: CfTokenPermissionCheck,
): string | null {
  if (check.status === "read_only") {
    return `${check.category} → ${check.name} is set to Read; it must be ${check.requiredAccess}.`;
  }
  if (check.status === "missing") {
    return `${check.category} → ${check.name} → ${check.requiredAccess} is missing.`;
  }
  return null;
}

/** Scopes needed for desktop auto-install (Wrangler deploy + R2 + D1). */
export const CF_INSTALL_TOKEN_PERMISSIONS = [
  "Account — Workers Scripts — Edit",
  "Account — Workers R2 Storage — Edit",
  "Account — D1 — Edit",
] as const;

/** Human-readable OAuth scopes shown during Setup → Authorize with Cloudflare. */
export const CF_OAUTH_INSTALL_SCOPES = [
  "D1 Write",
  "Workers R2 Storage Write",
  "Workers Scripts Write",
] as const;

/** Human-readable OAuth scope shown during Setup → I forgot my passtoken. */
export const CF_OAUTH_RECOVER_SCOPES = ["Secrets Store Write"] as const;

export type CfOAuthPurpose = "install" | "recover";

/** Max wait after opening the Cloudflare authorize URL before treating as cancelled. */
export const CF_OAUTH_AUTHORIZE_WAIT_MS = 3 * 60 * 1000;

/** True when Cloudflare's install OAuth session is gone or the access token is stale. */
export function isCloudflareAuthExpired(err: unknown): boolean {
  const lower = formatDesktopError(err).toLowerCase();
  if (err && typeof err === "object") {
    const help = err as { title?: unknown; detail?: unknown; fix?: unknown };
    const blob = [help.title, help.detail, help.fix]
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();
    if (
      blob.includes("authorization expired") ||
      blob.includes("cloudflare_auth_expired")
    ) {
      return true;
    }
  }
  return (
    lower.includes("cloudflare_auth_expired") ||
    lower.includes("authorization expired") ||
    lower.includes("code: 9109") ||
    lower.includes("invalid access token")
  );
}

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

/** Cloudflare dashboard → Worker production settings (variables and secrets). */
export function cloudflareWorkerSettingsUrl(
  accountId: string,
  scriptName = "relaybase-api",
): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/workers/services/view/${encodeURIComponent(scriptName)}/production/settings`;
}

/** Mail API is ready when the Worker `CF_API_TOKEN` exists. A false probe
 * fails; an omitted probe (older Worker) still counts as ready if the secret
 * is set. Worker `accountId` / `CF_ACCOUNT_ID` is optional — zone-scoped
 * APIs do not need it. Desktop UI links fall back to `credentials.accountId`. */
export function mailApiReady(result: {
  cfApiTokenSet?: boolean;
  cfApiTokenValid?: boolean;
  accountId?: string;
}): boolean {
  if (!result.cfApiTokenSet) return false;
  if (result.cfApiTokenValid === false) return false;
  return true;
}

export type CfApiTokenProbeState = {
  cfApiTokenSet?: boolean;
  cfApiTokenValid?: boolean;
};

/** True when CF_API_TOKEN exists on the Worker but Cloudflare rejected the probe. */
export function cfApiTokenPermissionsRejected(
  state: CfApiTokenProbeState | null | undefined,
): boolean {
  return Boolean(state?.cfApiTokenSet) && state?.cfApiTokenValid === false;
}

export type CfApiTokenHealth = {
  tone: "ok" | "bad" | "pending";
  label: string;
  detail: string;
};

/** Settings / dashboard copy for CF_API_TOKEN presence and permission probes. */
export function cfApiTokenHealth(
  state: CfApiTokenProbeState | null | undefined,
  options?: { pending?: boolean },
): CfApiTokenHealth {
  if (options?.pending) {
    return {
      tone: "pending",
      label: "Verifying API token…",
      detail: "Probing Cloudflare API token permissions on the Worker.",
    };
  }
  if (!state?.cfApiTokenSet) {
    return {
      tone: "bad",
      label: "Not configured",
      detail: "Use Enable email API to add the token, then verify.",
    };
  }
  if (state.cfApiTokenValid === false) {
    return {
      tone: "bad",
      label: "Permissions need fixing",
      detail:
        "CF_API_TOKEN is on the Worker, but Cloudflare rejected one or more permissions. Verify again to see which row to fix.",
    };
  }
  return {
    tone: "ok",
    label: "Configured",
    detail: "The API token is set on the Worker and Cloudflare accepted it.",
  };
}

/**
 * Single source of truth for resolving the effective Cloudflare Account ID:
 * 1. Worker pinned/reported account ID (from /console/connect)
 * 2. Saved workspace account ID (from ~/.relaybase/workspace.json)
 * 3. In-memory OAuth session account ID (fallback)
 */
export function resolveEffectiveCfAccountId(opts?: {
  workerAccountId?: string | null;
  credentialsAccountId?: string | null;
  accountId?: string | null;
  cfOauthAccountId?: string | null;
} | null): string {
  if (!opts) return "";
  return (
    opts.workerAccountId?.trim() ||
    opts.credentialsAccountId?.trim() ||
    opts.accountId?.trim() ||
    opts.cfOauthAccountId?.trim() ||
    ""
  );
}

/** Worker-reported id, else desktop credentials. For dashboard links and status display. */
export function displayCfAccountId(opts: {
  workerAccountId?: string | null;
  credentialsAccountId?: string | null;
  accountId?: string | null;
  cfOauthAccountId?: string | null;
}): string {
  return resolveEffectiveCfAccountId(opts);
}

/** Account this Mac connected via Cloudflare OAuth / Worker pin (`workspace.json`). */
export function connectedCfAccountId(credentials?: {
  accountId?: string | null;
  cfOauthAccountId?: string | null;
  workerAccountId?: string | null;
} | null): string {
  return resolveEffectiveCfAccountId(credentials);
}

/** Cloudflare dashboard → this account's Email Sending page. */
export function cloudflareEmailSendingUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/email-service/sending`;
}

/** Cloudflare dashboard → this account's domain overview (add a site). */
export function cloudflareDomainsOverviewUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  return `https://dash.cloudflare.com/${id}/domains/overview`;
}

/**
 * Cloudflare dashboard → this zone's Email Routing page. Zone-scoped, not
 * account-scoped: falls back to the account's zone list when `zoneId` is
 * unknown (e.g. onboarding hasn't resolved one yet).
 */
export function cloudflareEmailRoutingUrl(
  accountId: string,
  zoneId: string | null | undefined,
  page: "overview" | "routing-rules" = "overview",
): string {
  const id = accountId.trim();
  if (!id) return "https://dash.cloudflare.com/";
  const zone = zoneId?.trim();
  if (!zone) return `https://dash.cloudflare.com/${id}/email-service/routing`;
  return `https://dash.cloudflare.com/${id}/email-service/routing/${encodeURIComponent(zone)}/${page}`;
}

/** Cloudflare dashboard → this zone's Email Routing overview page. */
export function cloudflareEmailRoutingOverviewUrl(
  accountId: string,
  zoneId: string | null | undefined,
): string {
  return cloudflareEmailRoutingUrl(accountId, zoneId, "overview");
}

/** Cloudflare dashboard → this zone's Email Routing rules page (to verify a
 * specific address actually has a routing rule, not just what Relaybase's
 * own DB says). */
export function cloudflareEmailRoutingRulesUrl(
  accountId: string,
  zoneId: string | null | undefined,
): string {
  return cloudflareEmailRoutingUrl(accountId, zoneId, "routing-rules");
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

/** Cloudflare dashboard → a specific R2 bucket (falls back to overview). */
export function cloudflareR2BucketUrl(
  accountId: string,
  bucketName: string,
): string {
  const id = accountId.trim();
  const bucket = bucketName.trim();
  if (!id) return "https://dash.cloudflare.com/";
  if (!bucket) return cloudflareR2OverviewUrl(id);
  return `https://dash.cloudflare.com/${id}/r2/default/buckets/${encodeURIComponent(bucket)}`;
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
