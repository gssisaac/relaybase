import { desktopAwareFetch } from "@/lib/desktop/api/api-base";
import {
  desktopCheckWorkerUpdate,
  desktopVerifyWorkerConnection,
  type ZoneSummary,
} from "@/lib/desktop/bridge";

export function isZoneListNeedsWorkerUpdate(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return message.toLowerCase().includes("does not support zone listing");
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
      ? desktopVerifyWorkerConnection(url, "").catch(() => null)
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
export async function listCloudflareZones(): Promise<ZoneSummary[]> {
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
  return Array.isArray(data.zones) ? data.zones : [];
}
