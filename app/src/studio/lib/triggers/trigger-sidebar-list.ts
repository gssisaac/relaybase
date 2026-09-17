import type { Trigger } from "@/studio/api";
import { triggersHubStore } from "@/studio/stores/triggers-hub/triggers-hub-store";

/** Stable snapshot when the list has not loaded yet (required for useSyncExternalStore). */
const EMPTY_SIDEBAR_ROWS: Trigger[] = [];

export function subscribeTriggerSidebarList(listener: () => void): () => void {
  return triggersHubStore.subscribeSidebar(listener);
}

export function getTriggerSidebarListSnapshot(): Trigger[] {
  const rows = triggersHubStore.sidebarRows;
  return rows.length > 0 ? rows : EMPTY_SIDEBAR_ROWS;
}

export function getCachedTriggerSidebarList(): Trigger[] | null {
  return triggersHubStore.triggers.length > 0 ? triggersHubStore.sidebarRows : null;
}

export function invalidateTriggerSidebarList() {
  void triggersHubStore.refresh({ force: true });
}

export function replaceTriggerSidebarList(automations: Trigger[]) {
  triggersHubStore.replaceAll(automations);
}

export function removeTriggerSidebarListRow(triggerId: string) {
  triggersHubStore.removeTrigger(triggerId);
}

export function upsertTriggerSidebarListRow(row: Trigger) {
  triggersHubStore.upsertTrigger(row);
}

export async function fetchTriggerSidebarList(force = false): Promise<Trigger[]> {
  if (force) await triggersHubStore.refresh({ force: true });
  else await triggersHubStore.ensureLoaded();
  return getTriggerSidebarListSnapshot();
}
