"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { studioApi, type StudioAnalytics } from "@/studio/api";

function cloneAnalyticsPayload(next: StudioAnalytics): StudioAnalytics {
  return structuredClone(next);
}

export class AnalyticsStore {
  /** Plain JSON — not MobX-deep-observed (Recharts/Immer freeze chart data). */
  private payload: StudioAnalytics | null = null;
  /** Incremented when `payload` changes so observers re-render. */
  dataEpoch = 0;
  fetching = false;
  loadError: string | null = null;

  private fetchPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get data(): StudioAnalytics | null {
    return this.payload;
  }

  get showPlaceholder(): boolean {
    return this.payload === null && this.fetching;
  }

  get isRefreshing(): boolean {
    return this.payload !== null && this.fetching;
  }

  private commitPayload(next: StudioAnalytics | null) {
    this.payload = next ? cloneAnalyticsPayload(next) : null;
    this.dataEpoch += 1;
  }

  ensureLoaded(): Promise<void> {
    if (this.payload !== null) {
      void this.refresh();
      return Promise.resolve();
    }
    return this.refresh();
  }

  async refresh(options?: { force?: boolean }): Promise<void> {
    if (this.fetchPromise) return this.fetchPromise;

    const hasCache = this.payload !== null;
    if (!options?.force && !hasCache && this.fetching) {
      return this.fetchPromise ?? Promise.resolve();
    }

    this.fetching = true;
    this.fetchPromise = (async () => {
      try {
        const next = await studioApi.getAnalytics();
        runInAction(() => {
          this.commitPayload(next);
          this.loadError = null;
        });
      } catch {
        const message =
          "Could not load Studio analytics — is hq/studio running on port 32832?";
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
}

/** Session cache — survives remounts when leaving the analytics route. */
export const analyticsStore = new AnalyticsStore();
