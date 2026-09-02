import { formatDesktopError } from "./invoke";

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
  notes?: string;
};

export type WorkerUpdateCheck = {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion?: string | null;
  zipUrl?: string | null;
  zipSha256?: string | null;
};

/**
 * Optional Cloudflare API token scopes for Zone / Email Routing assist
 * (Domains import, routing automation, DMARC DNS). Not required for Worker self-install.
 */
export const CF_REQUIRED_TOKEN_PERMISSIONS = [
  "Zone — Email Routing Rules — Edit",
  "Zone — Zone — Read",
  "Zone — DNS — Edit",
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

/** Worker-reported id, else desktop credentials. For dashboard links only. */
export function displayCfAccountId(opts: {
  workerAccountId?: string | null;
  credentialsAccountId?: string | null;
}): string {
  return (
    opts.workerAccountId?.trim() || opts.credentialsAccountId?.trim() || ""
  );
}

/** Account this Mac connected via Cloudflare OAuth (`workspace.json`). */
export function connectedCfAccountId(credentials?: {
  accountId?: string | null;
  cfOauthAccountId?: string | null;
} | null): string {
  return (
    credentials?.accountId?.trim() ||
    credentials?.cfOauthAccountId?.trim() ||
    ""
  );
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
