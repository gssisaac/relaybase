import { ensureCloudWorkerSession } from "@/lib/auth/cloud-worker-session";
import type { DomainSummary } from "@/lib/dashboard/domain-store";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { desktopAwareFetch, readResponseJson } from "@/lib/desktop/api";
import type { Address } from "@/email/components/mailbox/types";
import {
  getHqUser,
  hasHqSession,
  hqRefreshSession,
} from "@/lib/hq-auth/session";
import { DEFAULT_STUDIO_PATH } from "@/lib/navigation/sidebar-paths";

export const ONBOARDING_PATH = "/onboarding";

function domainIsReady(entry: DomainSummary): boolean {
  return !entry.onboarding || entry.onboarding.status === "ready";
}

/**
 * Web cloud owners who have not finished domain + primary address setup.
 * Desktop and team accounts are excluded.
 */
export async function shouldRedirectToCloudOnboarding(): Promise<boolean> {
  if (isDesktopRuntime()) return false;

  if (!hasHqSession()) {
    const ok = await hqRefreshSession();
    if (!ok) return false;
  }

  const user = getHqUser();
  if (!user || user.type === "team") return false;

  if (!user.workerUrl?.trim()) return true;

  await ensureCloudWorkerSession().catch(() => false);

  try {
    const res = await desktopAwareFetch("/api/email/domains", {
      cache: "no-store",
    });
    const data = await readResponseJson<{ domains?: DomainSummary[]; error?: string }>(
      res,
    );
    if (!res.ok) return false;

    const readyDomains = (data.domains ?? []).filter(domainIsReady);
    if (readyDomains.length === 0) return true;

    for (const entry of readyDomains) {
      const addrRes = await desktopAwareFetch(
        `/api/email/addresses?domain=${encodeURIComponent(entry.domain)}`,
        { cache: "no-store" },
      );
      const addrData = await readResponseJson<{ addresses?: Address[] }>(addrRes);
      if (addrRes.ok && (addrData.addresses?.length ?? 0) > 0) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/** Post-login / post-refresh landing path for web cloud owners. */
export async function resolveCloudOwnerLandingPath(
  next: string | null | undefined,
  defaultPath = DEFAULT_STUDIO_PATH,
): Promise<string> {
  const trimmed = next?.trim();
  if (trimmed?.startsWith("/")) {
    if (trimmed === ONBOARDING_PATH || trimmed.startsWith(`${ONBOARDING_PATH}?`)) {
      return trimmed;
    }
  }

  if (await shouldRedirectToCloudOnboarding()) {
    return ONBOARDING_PATH;
  }

  if (trimmed?.startsWith("/")) {
    return trimmed;
  }

  return defaultPath;
}
