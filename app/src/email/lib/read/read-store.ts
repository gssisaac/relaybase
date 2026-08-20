import { readUiJson, UI_FILES, writeUiJson } from "@/email/lib/disk/user-ui-disk";

/**
 * Read/unread truth now lives on the Worker (`RoutingActivityEvent.readAt`,
 * set via `POST /api/email/inbox/read`). This file only persists a small
 * local *override* cache — optimistic UI while a mark-read/unread request is
 * in flight, and a resilience buffer if the app is offline — never the
 * source of truth. See docs/relaybase-home-storage.md and
 * docs/inbox-threading-and-multi-account.md.
 *
 * `true` = force-read, `false` = force-unread. A key is removed from the map
 * once a subsequent server fetch confirms the same state, so this map should
 * normally stay small/empty.
 */
export type ReadOverrides = Record<string, boolean>;

/** Legacy on-disk shape, from before read state moved to the server. */
type LegacyReadFile = { keys?: unknown };
type ReadFile = { version?: number; overrides?: unknown };

const KEY_PREFIX = "relaybase:mail-read:";

export function readKeysStorageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function normalizeOverrides(raw: unknown): ReadOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: ReadOverrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === "string" && key && typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

function normalizeLegacyKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (key): key is string => typeof key === "string" && key.length > 0,
  );
}

function writeLocalOverrides(userId: string, overrides: ReadOverrides) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(
      readKeysStorageKey(userId),
      JSON.stringify({ version: 2, overrides }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function writeReadOverrides(userId: string, overrides: ReadOverrides) {
  void writeUiJson(userId, UI_FILES.read, { version: 2, overrides })
    .then(() => writeLocalOverrides(userId, overrides))
    .catch((err) => {
      console.error("[relaybase] failed to persist read overrides", err);
    });
}

export type HydratedReadState = {
  overrides: ReadOverrides;
  /**
   * Non-null exactly once, right after reading a pre-migration `{ keys }`
   * file — the caller should reconcile these against server `readAt` values
   * once, then call `writeReadOverrides` to finalize the v2 shape.
   */
  legacyReadKeys: string[] | null;
};

function parseReadFile(raw: unknown): HydratedReadState {
  if (raw && typeof raw === "object" && "version" in (raw as ReadFile)) {
    return {
      overrides: normalizeOverrides((raw as ReadFile).overrides),
      legacyReadKeys: null,
    };
  }
  const legacyKeys = normalizeLegacyKeys((raw as LegacyReadFile | null)?.keys);
  return { overrides: {}, legacyReadKeys: legacyKeys };
}

/** Load from ~/.relaybase (desktop), falling back to localStorage once. */
export async function hydrateReadState(
  userId: string,
): Promise<HydratedReadState | null> {
  if (!userId) return null;
  const disk = await readUiJson<ReadFile | LegacyReadFile>(
    userId,
    UI_FILES.read,
  );
  if (disk !== null) {
    const parsed = parseReadFile(disk);
    if (!parsed.legacyReadKeys) writeLocalOverrides(userId, parsed.overrides);
    return parsed;
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(readKeysStorageKey(userId));
    if (raw === null) return null;
    return parseReadFile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}
