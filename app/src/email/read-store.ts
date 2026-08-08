const KEY_PREFIX = "relaybase:mail-read:";

export function readKeysStorageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

/** Returns null when no read state has been persisted yet (first-run baseline). */
export function readReadKeys(userId: string): string[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(readKeysStorageKey(userId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is string => typeof key === "string" && key.length > 0);
  } catch {
    return [];
  }
}

export function writeReadKeys(userId: string, keys: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(readKeysStorageKey(userId), JSON.stringify(keys));
  } catch {
    // ignore quota / private mode
  }
}
