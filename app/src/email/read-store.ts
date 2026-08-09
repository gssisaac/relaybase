import { readUiJson, UI_FILES, writeUiJson } from "@/email/user-ui-disk";

const KEY_PREFIX = "relaybase:mail-read:";

export function readKeysStorageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function normalizeKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (key): key is string => typeof key === "string" && key.length > 0,
  );
}

/** Returns null when no read state has been persisted yet (first-run baseline). */
export function readReadKeys(userId: string): string[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(readKeysStorageKey(userId));
    if (raw === null) return null;
    return normalizeKeys(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeLocalReadKeys(userId: string, keys: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(readKeysStorageKey(userId), JSON.stringify(keys));
  } catch {
    // ignore quota / private mode
  }
}

export function writeReadKeys(userId: string, keys: string[]) {
  void writeUiJson(userId, UI_FILES.read, { keys })
    .then(() => writeLocalReadKeys(userId, keys))
    .catch((err) => {
      console.error("[relaybase] failed to persist read state", err);
    });
}

/** Load from ~/.relaybase (desktop), migrate legacy localStorage once. */
export async function hydrateReadKeys(userId: string): Promise<string[] | null> {
  if (!userId) return null;
  const disk = await readUiJson<{ keys?: unknown }>(userId, UI_FILES.read);
  if (disk && "keys" in disk) {
    const keys = normalizeKeys(disk.keys);
    writeLocalReadKeys(userId, keys);
    return keys;
  }
  const local = readReadKeys(userId);
  if (local !== null) {
    await writeUiJson(userId, UI_FILES.read, { keys: local });
  }
  return local;
}
