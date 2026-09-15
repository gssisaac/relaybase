import { scaleApi, type Automation } from "@/lib/scale/api";

let cachedRows: Automation[] | null = null;
let inflight: Promise<Automation[]> | null = null;
const listeners = new Set<() => void>();

function filterSidebarRows(automations: Automation[]): Automation[] {
  return automations.filter((row) => row.listStatus !== "archived");
}

function emitSidebarListChange() {
  for (const listener of listeners) listener();
}

export function subscribeAutomationSidebarList(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAutomationSidebarListSnapshot(): Automation[] {
  return cachedRows ?? [];
}

export function getCachedAutomationSidebarList(): Automation[] | null {
  return cachedRows;
}

export function invalidateAutomationSidebarList() {
  cachedRows = null;
  inflight = null;
  emitSidebarListChange();
}

export function replaceAutomationSidebarList(automations: Automation[]) {
  cachedRows = filterSidebarRows(automations);
  inflight = null;
  emitSidebarListChange();
}

export function upsertAutomationSidebarListRow(row: Automation) {
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

export async function fetchAutomationSidebarList(force = false): Promise<Automation[]> {
  if (!force && cachedRows) return cachedRows;
  if (!force && inflight) return inflight;

  inflight = scaleApi
    .listAutomations()
    .then((res) => {
      cachedRows = filterSidebarRows(res.automations);
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
