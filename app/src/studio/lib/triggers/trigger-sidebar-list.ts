import { studioApi, type Trigger } from "@/studio/api";

let cachedRows: Trigger[] | null = null;
let inflight: Promise<Trigger[]> | null = null;
const listeners = new Set<() => void>();

/** Stable snapshot when the list has not loaded yet (required for useSyncExternalStore). */
const EMPTY_SIDEBAR_ROWS: Trigger[] = [];

function filterSidebarRows(automations: Trigger[]): Trigger[] {
  return automations.filter((row) => row.listStatus !== "archived");
}

function emitSidebarListChange() {
  for (const listener of listeners) listener();
}

export function subscribeTriggerSidebarList(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTriggerSidebarListSnapshot(): Trigger[] {
  return cachedRows ?? EMPTY_SIDEBAR_ROWS;
}

export function getCachedTriggerSidebarList(): Trigger[] | null {
  return cachedRows;
}

export function invalidateTriggerSidebarList() {
  cachedRows = null;
  inflight = null;
  emitSidebarListChange();
}

export function replaceTriggerSidebarList(automations: Trigger[]) {
  cachedRows = filterSidebarRows(automations);
  inflight = null;
  emitSidebarListChange();
}

export function removeTriggerSidebarListRow(triggerId: string) {
  if (!cachedRows) return;
  const next = cachedRows.filter((r) => r.id !== triggerId);
  if (next.length === cachedRows.length) return;
  cachedRows = next;
  emitSidebarListChange();
}

export function upsertTriggerSidebarListRow(row: Trigger) {
  if (!cachedRows) return;
  const idx = cachedRows.findIndex((r) => r.id === row.id);
  if (row.listStatus === "archived") {
    if (idx >= 0) {
      cachedRows = cachedRows.filter((r) => r.id !== row.id);
      emitSidebarListChange();
    }
    return;
  }
  if (idx >= 0) {
    cachedRows = cachedRows.map((r) => (r.id === row.id ? row : r));
  } else {
    cachedRows = [row, ...cachedRows];
  }
  emitSidebarListChange();
}

export async function fetchTriggerSidebarList(force = false): Promise<Trigger[]> {
  if (!force && cachedRows) return cachedRows;
  if (!force && inflight) return inflight;

  inflight = studioApi
    .listTriggers()
    .then((res) => {
      cachedRows = filterSidebarRows(res.triggers);
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
