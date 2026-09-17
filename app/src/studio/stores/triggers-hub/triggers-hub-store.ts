"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { studioApi, type Trigger } from "@/studio/api";

function cloneTriggers(triggers: Trigger[]): Trigger[] {
  return structuredClone(triggers);
}

function visibleTriggers(triggers: Trigger[]): Trigger[] {
  return triggers.filter((row) => row.listStatus !== "archived");
}

export class TriggersHubStore {
  private payload: Trigger[] = [];
  dataEpoch = 0;
  fetching = false;
  loadError: string | null = null;

  private fetchPromise: Promise<void> | null = null;
  private sidebarListeners = new Set<() => void>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get triggers(): Trigger[] {
    return this.payload;
  }

  /** Non-archived rows — list UI and detail sidebar. */
  get sidebarRows(): Trigger[] {
    return visibleTriggers(this.payload);
  }

  get showPlaceholder(): boolean {
    return this.payload.length === 0 && this.fetching;
  }

  get isRefreshing(): boolean {
    return this.payload.length > 0 && this.fetching;
  }

  getTrigger(id: string): Trigger | undefined {
    return this.payload.find((row) => row.id === id);
  }

  subscribeSidebar(listener: () => void): () => void {
    this.sidebarListeners.add(listener);
    return () => this.sidebarListeners.delete(listener);
  }

  private emitSidebar() {
    for (const listener of this.sidebarListeners) listener();
  }

  private commitTriggers(triggers: Trigger[]) {
    this.payload = cloneTriggers(triggers);
    this.dataEpoch += 1;
    this.emitSidebar();
  }

  ensureLoaded(): Promise<void> {
    if (this.payload.length > 0) {
      void this.refresh();
      return Promise.resolve();
    }
    return this.refresh();
  }

  async refresh(options?: { force?: boolean }): Promise<void> {
    if (this.fetchPromise) return this.fetchPromise;

    const hasCache = this.payload.length > 0;
    if (!options?.force && !hasCache && this.fetching) {
      return this.fetchPromise ?? Promise.resolve();
    }

    this.fetching = true;
    this.fetchPromise = (async () => {
      try {
        const result = await studioApi.listTriggers();
        runInAction(() => {
          this.commitTriggers(result.triggers ?? []);
          this.loadError = null;
        });
      } catch {
        const message = "Could not load triggers";
        runInAction(() => {
          if (!hasCache) this.loadError = message;
        });
        if (!hasCache) throw new Error(message);
      } finally {
        runInAction(() => {
          this.fetching = false;
          this.fetchPromise = null;
        });
      }
    })();

    return this.fetchPromise;
  }

  replaceAll(triggers: Trigger[]) {
    this.commitTriggers(triggers);
  }

  upsertTrigger(row: Trigger) {
    const idx = this.payload.findIndex((r) => r.id === row.id);
    const cloned = structuredClone(row);
    if (idx >= 0) {
      const next = [...this.payload];
      next[idx] = cloned;
      this.commitTriggers(next);
      return;
    }
    this.commitTriggers([cloned, ...this.payload]);
  }

  removeTrigger(id: string) {
    this.commitTriggers(this.payload.filter((r) => r.id !== id));
  }
}

export const triggersHubStore = new TriggersHubStore();
