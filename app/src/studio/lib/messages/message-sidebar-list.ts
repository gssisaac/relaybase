import { studioApi, type StudioMessage } from "@/studio/api";

/** Excludes catalog preset YAML ids if they ever appear under `/studio/messages`. */
export function isMessageSidebarRow(row: StudioMessage): boolean {
  const id = row.id.trim();
  if (!id) return false;
  if (id.startsWith("msgtpl_preset_")) return false;
  return true;
}

function filterSidebarRows(rows: StudioMessage[]): StudioMessage[] {
  return rows.filter(isMessageSidebarRow);
}

let cachedRows: StudioMessage[] | null = null;
let inflight: Promise<StudioMessage[]> | null = null;
const listeners = new Set<() => void>();

const EMPTY_SIDEBAR_ROWS: StudioMessage[] = [];

function emitSidebarListChange() {
  for (const listener of listeners) listener();
}

export function subscribeMessageSidebarList(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMessageSidebarListSnapshot(): StudioMessage[] {
  return cachedRows ?? EMPTY_SIDEBAR_ROWS;
}

export function getCachedMessageSidebarList(): StudioMessage[] | null {
  return cachedRows;
}

export function invalidateMessageSidebarList() {
  cachedRows = null;
  inflight = null;
  emitSidebarListChange();
}

export function replaceMessageSidebarList(messages: StudioMessage[]) {
  cachedRows = messages;
  inflight = null;
  emitSidebarListChange();
}

export function removeMessageSidebarListRow(messageId: string) {
  if (!cachedRows) return;
  const next = cachedRows.filter((r) => r.id !== messageId);
  if (next.length === cachedRows.length) return;
  cachedRows = next;
  emitSidebarListChange();
}

export function upsertMessageSidebarListRow(row: StudioMessage) {
  if (!isMessageSidebarRow(row)) return;
  if (!cachedRows) {
    return;
  }
  const idx = cachedRows.findIndex((r) => r.id === row.id);
  if (idx >= 0) {
    cachedRows = cachedRows.map((r) => (r.id === row.id ? row : r));
  } else {
    cachedRows = [row, ...cachedRows];
  }
  emitSidebarListChange();
}

export async function fetchMessageSidebarList(force = false): Promise<StudioMessage[]> {
  if (!force && cachedRows) return cachedRows;
  if (!force && inflight) return inflight;

  inflight = studioApi
    .listMessages()
    .then((res) => {
      cachedRows = filterSidebarRows(res.messages);
      inflight = null;
      emitSidebarListChange();
      return cachedRows;
    })
    .catch(() => {
      inflight = null;
      return cachedRows ?? [];
    });

  return inflight;
}
