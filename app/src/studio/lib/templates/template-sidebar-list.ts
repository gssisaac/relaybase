import { studioApi, type MessageTemplate } from "@/lib/studio/api";

let cachedRows: MessageTemplate[] | null = null;
let inflight: Promise<MessageTemplate[]> | null = null;
const listeners = new Set<() => void>();

const EMPTY_SIDEBAR_ROWS: MessageTemplate[] = [];

function emitSidebarListChange() {
  for (const listener of listeners) listener();
}

export function subscribeTemplateSidebarList(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTemplateSidebarListSnapshot(): MessageTemplate[] {
  return cachedRows ?? EMPTY_SIDEBAR_ROWS;
}

export function getCachedTemplateSidebarList(): MessageTemplate[] | null {
  return cachedRows;
}

export function invalidateTemplateSidebarList() {
  cachedRows = null;
  inflight = null;
  emitSidebarListChange();
}

export function replaceTemplateSidebarList(templates: MessageTemplate[]) {
  cachedRows = templates;
  inflight = null;
  emitSidebarListChange();
}

export function removeTemplateSidebarListRow(templateId: string) {
  if (!cachedRows) return;
  const next = cachedRows.filter((r) => r.id !== templateId);
  if (next.length === cachedRows.length) return;
  cachedRows = next;
  emitSidebarListChange();
}

export function upsertTemplateSidebarListRow(row: MessageTemplate) {
  if (!cachedRows) {
    cachedRows = [row];
    emitSidebarListChange();
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

export async function fetchTemplateSidebarList(force = false): Promise<MessageTemplate[]> {
  if (!force && cachedRows) return cachedRows;
  if (!force && inflight) return inflight;

  inflight = studioApi
    .listMessageTemplates()
    .then((res) => {
      cachedRows = res.templates;
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
