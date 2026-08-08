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

export function readTrash(userId: string): TrashEntry[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(trashKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is TrashEntry =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as TrashEntry).id === "string" &&
        ((entry as TrashEntry).kind === "inbox" ||
          (entry as TrashEntry).kind === "sent") &&
        typeof (entry as TrashEntry).trashedAt === "string",
    );
  } catch {
    return [];
  }
}

export function writeTrash(userId: string, entries: TrashEntry[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(trashKey(userId), JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

export function trashEntryKey(kind: TrashKind, id: string) {
  return `${kind}:${id}`;
}
