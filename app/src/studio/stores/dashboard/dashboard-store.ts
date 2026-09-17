"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { studioApi, type StudioDashboardPayload } from "@/studio/api";

const SENDING_POLL_MS = 5_000;

function cloneDashboardPayload(next: StudioDashboardPayload): StudioDashboardPayload {
  return structuredClone(next);
}

export class DashboardStore {
  private payload: StudioDashboardPayload | null = null;
  dataEpoch = 0;
  fetching = false;
  loadError: string | null = null;

  private fetchPromise: Promise<void> | null = null;
  private sendingPollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    makeAutoObservable<
      DashboardStore,
      "payload" | "fetchPromise" | "sendingPollTimer"
    >(
      this,
      {
        payload: false,
        fetchPromise: false,
        sendingPollTimer: false,
      },
      { autoBind: true },
    );
  }

  get data(): StudioDashboardPayload | null {
    return this.payload;
  }

  get showPlaceholder(): boolean {
    return this.payload === null && this.fetching;
  }

  get isRefreshing(): boolean {
    return this.payload !== null && this.fetching;
  }

  get hasSending(): boolean {
    return Boolean(this.payload?.sending);
  }

  private commitPayload(next: StudioDashboardPayload | null) {
    this.payload = next ? cloneDashboardPayload(next) : null;
    this.dataEpoch += 1;
  }

  ensureLoaded(): Promise<void> {
    if (this.payload !== null) {
      void this.refresh();
      this.syncSendingPoll();
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
        const next = await studioApi.getDashboard();
        runInAction(() => {
          this.commitPayload(next);
          this.loadError = null;
        });
        this.syncSendingPoll();
      } catch {
        const message =
          "Could not load Studio dashboard — is hq/studio running on port 32832?";
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

  private syncSendingPoll() {
    if (this.hasSending) {
      if (this.sendingPollTimer !== null) return;
      this.sendingPollTimer = setInterval(() => {
        void this.refresh({ force: true });
      }, SENDING_POLL_MS);
      return;
    }
    if (this.sendingPollTimer !== null) {
      clearInterval(this.sendingPollTimer);
      this.sendingPollTimer = null;
    }
  }

  dispose() {
    if (this.sendingPollTimer !== null) {
      clearInterval(this.sendingPollTimer);
      this.sendingPollTimer = null;
    }
  }
}

/** Session cache — survives remounts when leaving the dashboard route. */
export const dashboardStore = new DashboardStore();
