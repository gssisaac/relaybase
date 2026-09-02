import { normalizeCfAccountId } from "./cf-account-id.ts";

export type CfListedZone = {
  id: string;
  name: string;
  status: string;
  accountId: string;
};

export function mapCfZoneRow(zone: {
  id?: string;
  name?: string;
  status?: string;
  account?: { id?: string };
}): CfListedZone {
  return {
    id: zone.id ?? "",
    name: zone.name ?? "",
    status: zone.status ?? "",
    accountId: normalizeCfAccountId(zone.account?.id) ?? "",
  };
}

/**
 * Keep zones on the pinned CF account. An empty pin does not filter —
 * the desktop then uses the OAuth-selected account id.
 */
export function zonesOnPinnedAccount<T extends { accountId?: string }>(
  zones: T[],
  pinnedAccountId: string | null | undefined,
): T[] {
  const pinned = normalizeCfAccountId(pinnedAccountId);
  if (!pinned) return zones;
  return zones.filter(
    (zone) => normalizeCfAccountId(zone.accountId) === pinned,
  );
}

export function zoneBelongsToPinnedAccount(
  zoneAccountId: string | null | undefined,
  pinnedAccountId: string | null | undefined,
): boolean {
  const pinned = normalizeCfAccountId(pinnedAccountId);
  if (!pinned) return true;
  return normalizeCfAccountId(zoneAccountId) === pinned;
}

export function zonesListQuery(
  page: number,
  pinnedAccountId?: string | null,
): string {
  const params = new URLSearchParams({
    per_page: "50",
    page: String(page),
  });
  const pinned = normalizeCfAccountId(pinnedAccountId);
  if (pinned) params.set("account.id", pinned);
  return params.toString();
}
