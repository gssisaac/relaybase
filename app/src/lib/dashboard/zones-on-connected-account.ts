/**
 * Keep only zones on the pinned Cloudflare account.
 * No pin, or a zone with no/other account id → omit. Never return
 * token-wide leftovers from another CF account.
 */
export function zonesOnConnectedAccount<T extends { accountId?: string }>(
  zones: T[],
  connectedAccountId?: string | null,
): T[] {
  const pinned = connectedAccountId?.trim().toLowerCase() ?? "";
  if (!pinned) return [];
  return zones.filter(
    (zone) => zone.accountId?.trim().toLowerCase() === pinned,
  );
}
