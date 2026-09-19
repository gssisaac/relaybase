import type { DomainOnboardingSummary } from "@/lib/dashboard/domain-store";

/** Zone exists on Cloudflare but NS are not active yet, or domain is missing from CF. */
export function isZoneNeedSetup(
  onboarding: DomainOnboardingSummary | null | undefined,
): boolean {
  if (!onboarding || onboarding.status !== "waiting") return false;
  return (
    onboarding.lastErrorCode === "ZONE_PENDING" ||
    onboarding.lastErrorCode === "ZONE_NOT_FOUND"
  );
}

export function domainIsMailReady(
  onboarding: DomainOnboardingSummary | null | undefined,
): boolean {
  return !onboarding || onboarding.status === "ready";
}
