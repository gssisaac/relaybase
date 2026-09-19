import { resolveEmailApiBase } from "@/lib/desktop/api";
import { studioApi } from "@/studio/api";

/** When Studio runs without desktop credentials, use hq/studio account-link workerUrl. */
export async function hydrateWorkerUrlFromStudioAccountLink(): Promise<string | null> {
  const existing = resolveEmailApiBase();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  try {
    const link = await studioApi.getAccountLink();
    const url = link.workerUrl?.trim().replace(/\/$/, "") ?? "";
    if (!url) return null;
    const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
    w.__RELAYBASE_WORKER_URL__ = url;
    return url;
  } catch {
    return null;
  }
}
