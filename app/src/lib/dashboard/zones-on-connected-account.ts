/**
 * Drop zones that belong to a different Cloudflare account than the one
 * this desktop connected.
 *
 * - Older Workers omit `accountId` — keep the list (Worker update filters).
 * - Mixed accounts + a connected id → keep only that account.
 * - Worker already scoped to a single other account → keep that list
 *   (those are the zones this Worker can actually onboard).
 */
export function zonesOnConnectedAccount<T extends { accountId?: string }>(
  zones: T[],
  connectedAccountId?: string | null,
): T[] {
  const pinned = connectedAccountId?.trim().toLowerCase() ?? "";
  if (!pinned) return zones;
  const tagged = zones.filter((zone) => zone.accountId?.trim());
  if (tagged.length === 0) return zones;
  const matching = zones.filter(
    (zone) => zone.accountId?.trim().toLowerCase() === pinned,
  );
  if (matching.length > 0) return matching;
  const accounts = new Set(
    tagged.map((zone) => zone.accountId!.trim().toLowerCase()),
  );
  if (accounts.size === 1) return zones;
  return [];
}
