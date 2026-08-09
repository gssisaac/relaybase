import { readUiJson, UI_FILES, writeUiJson } from "@/email/user-ui-disk";

export type TrashKind = "inbox" | "sent";

export type TrashEntry = {
  id: string;
  kind: TrashKind;
  trashedAt: string;
};

const KEY_PREFIX = "relaybase:mail-trash:";

export function trashKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function normalizeTrash(raw: unknown): TrashEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is TrashEntry =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as TrashEntry).id === "string" &&
      ((entry as TrashEntry).kind === "inbox" ||
        (entry as TrashEntry).kind === "sent") &&
      typeof (entry as TrashEntry).trashedAt === "string",
  );
}

export function readTrash(userId: string): TrashEntry[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(trashKey(userId));
    if (!raw) return [];
    return normalizeTrash(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeLocalTrash(userId: string, entries: TrashEntry[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(trashKey(userId), JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

export function writeTrash(userId: string, entries: TrashEntry[]) {
  void writeUiJson(userId, UI_FILES.trash, { entries })
    .then(() => writeLocalTrash(userId, entries))
    .catch((err) => {
      console.error("[relaybase] failed to persist trash", err);
    });
}

/** Load from ~/.relaybase (desktop), migrate legacy localStorage once. */
export async function hydrateTrash(userId: string): Promise<TrashEntry[]> {
  if (!userId) return [];
  const disk = await readUiJson<{ entries?: unknown }>(userId, UI_FILES.trash);
  if (disk && Array.isArray(disk.entries)) {
    const entries = normalizeTrash(disk.entries);
    writeLocalTrash(userId, entries);
    return entries;
  }
  const local = readTrash(userId);
  if (local.length > 0) {
    await writeUiJson(userId, UI_FILES.trash, { entries: local });
  }
  return local;
}

export function trashEntryKey(kind: TrashKind, id: string) {
  return `${kind}:${id}`;
}
