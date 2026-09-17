"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { studioSubscriberApi } from "@/studio/api";
import type { SubscriberGroupSummary } from "@/email/components/mailbox/types";

function cloneGroups(groups: SubscriberGroupSummary[]): SubscriberGroupSummary[] {
  return structuredClone(groups);
}

export class SubscriberGroupsStore {
  private payload: SubscriberGroupSummary[] = [];
  dataEpoch = 0;
  fetching = false;
  loadError: string | null = null;

  private emailsPayload: Record<string, string[]> = {};
  emailsEpoch = 0;
  emailsFetching = false;

  private fetchPromise: Promise<void> | null = null;
  private emailsFetchPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get groups(): SubscriberGroupSummary[] {
    return this.payload;
  }

  get contactEmailsByGroupId(): Record<string, string[]> {
    return this.emailsPayload;
  }

  get showPlaceholder(): boolean {
    return this.payload.length === 0 && this.fetching;
  }

  get isRefreshing(): boolean {
    return this.payload.length > 0 && this.fetching;
  }

  getGroup(id: string): SubscriberGroupSummary | undefined {
    return this.payload.find((g) => g.id === id);
  }

  private commitGroups(groups: SubscriberGroupSummary[]) {
    this.payload = cloneGroups(groups);
    this.dataEpoch += 1;
  }

  private commitEmails(map: Record<string, string[]>) {
    this.emailsPayload = structuredClone(map);
    this.emailsEpoch += 1;
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
        const result = await studioSubscriberApi.listGroups();
        runInAction(() => {
          this.commitGroups(result.groups ?? []);
          this.loadError = null;
        });
        void this.refreshContactEmails();
      } catch {
        const message = "Could not load subscriber groups";
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

  async refreshContactEmails(): Promise<void> {
    if (this.emailsFetchPromise) return this.emailsFetchPromise;

    const groupIds = this.payload.map((g) => g.id);
    if (groupIds.length === 0) {
      runInAction(() => {
        this.commitEmails({});
        this.emailsFetching = false;
      });
      return Promise.resolve();
    }

    this.emailsFetching = true;
    this.emailsFetchPromise = (async () => {
      try {
        const entries = await Promise.all(
          groupIds.map(async (id) => {
            try {
              const detail = await studioSubscriberApi.getGroup(id);
              return [
                id,
                detail.contacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean),
              ] as const;
            } catch {
              return [id, [] as string[]] as const;
            }
          }),
        );
        runInAction(() => {
          this.commitEmails(Object.fromEntries(entries));
        });
      } finally {
        runInAction(() => {
          this.emailsFetching = false;
          this.emailsFetchPromise = null;
        });
      }
    })();

    return this.emailsFetchPromise;
  }

  /** After detail save — keep list row in sync without full reload when possible. */
  upsertGroupSummary(group: SubscriberGroupSummary) {
    const idx = this.payload.findIndex((g) => g.id === group.id);
    if (idx < 0) {
      this.commitGroups([group, ...this.payload]);
      return;
    }
    const next = [...this.payload];
    next[idx] = structuredClone(group);
    this.commitGroups(next);
  }

  removeGroup(id: string) {
    this.commitGroups(this.payload.filter((g) => g.id !== id));
    const { [id]: _, ...rest } = this.emailsPayload;
    this.commitEmails(rest);
  }
}

/** Session cache — survives remounts when leaving /studio/subscribers. */
export const subscriberGroupsStore = new SubscriberGroupsStore();
