import { desktopAwareFetch } from "@/lib/desktop/api/api-base";
import {
  desktopCheckWorkerUpdate,
  desktopVerifyWorkerConnection,
  WORKER_INSTALL_MANIFEST_URL,
  type WorkerInstallManifest,
  type ZoneSummary,
} from "@/lib/desktop/bridge";
import { workerNeedsUpgrade } from "@/lib/dashboard/worker-version";
import { zonesOnConnectedAccount } from "@/lib/dashboard/zones-on-connected-account";

export { workerNeedsUpgrade } from "@/lib/dashboard/worker-version";
export { zonesOnConnectedAccount } from "@/lib/dashboard/zones-on-connected-account";

export function isZoneListNeedsWorkerUpdate(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return message.toLowerCase().includes("does not support zone listing");
}

/** Public GET /health version — no owner session required (Setup probe). */
export async function fetchPublicWorkerHealthVersion(
  workerUrl: string,
): Promise<string | null> {
  const base = workerUrl.trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { version?: string };
    const version = data.version?.trim() ?? "";
    if (!version || version === "unknown") return null;
    return version;
  } catch {
    return null;
  }
}

async function fetchHostedInstallVersion(): Promise<string> {
  try {
    const res = await fetch(WORKER_INSTALL_MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json().catch(() => ({}))) as WorkerInstallManifest;
    return data.version?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Live Worker `/health` vs hosted install manifest.
 * Use during Setup — `desktopVerifyWorkerConnection` requires a console session.
 */
export async function loadPublicWorkerVersionCompare(workerUrl: string): Promise<{
  current: string;
  latest: string;
  needsUpgrade: boolean;
} | null> {
  const url = workerUrl.trim();
  if (!url) return null;
  const [healthVersion, check] = await Promise.all([
    fetchPublicWorkerHealthVersion(url),
    desktopCheckWorkerUpdate().catch(() => null),
  ]);
  const latest =
    check?.latestVersion?.trim() || (await fetchHostedInstallVersion());
  const current = healthVersion ?? "";
  if (!current && !latest) return null;
  return {
    current: current || "unknown",
    latest: latest || "unknown",
    needsUpgrade: workerNeedsUpgrade(current, latest),
  };
}

/** Running Worker version vs hosted install manifest. */
export async function loadWorkerVersionCompare(workerUrl?: string): Promise<{
  current: string;
  latest: string;
} | null> {
  const url = workerUrl?.trim() ?? "";
  const [check, connect] = await Promise.all([
    desktopCheckWorkerUpdate().catch(() => null),
    url
      ? desktopVerifyWorkerConnection(url).catch(() => null)
      : Promise.resolve(null),
  ]);
  const current =
    connect?.version?.trim() ||
    check?.currentVersion?.trim() ||
    "";
  const latest = check?.latestVersion?.trim() || "";
  if (!current && !latest) return null;
  return {
    current: current || "unknown",
    latest: latest || "unknown",
  };
}

/** List Cloudflare zones via the Worker `CF_API_TOKEN` (`GET /console/zones`). */
export async function listCloudflareZones(
  connectedAccountId?: string | null,
): Promise<ZoneSummary[]> {
  const res = await desktopAwareFetch("/api/email/zones");
  const data = (await res.json().catch(() => ({}))) as {
    zones?: ZoneSummary[];
    error?: string;
  };
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "This Worker does not support zone listing yet. Check for a Worker update in Settings, then retry.",
      );
    }
    throw new Error(data.error ?? "Failed to list zones");
  }
  const zones = Array.isArray(data.zones) ? data.zones : [];
  return zonesOnConnectedAccount(zones, connectedAccountId);
}
