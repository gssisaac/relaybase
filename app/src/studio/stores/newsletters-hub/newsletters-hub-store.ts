"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  studioApi,
  type AccountSentOverview,
  type InProgressOverview,
  type Newsletter,
  type StudioLayout,
} from "@/studio/api";
import {
  studioLoadErrorMessage,
  studioUserMessages,
} from "@/studio/lib/studio-user-messages";

const IN_PROGRESS_POLL_MS = 3000;
const LIST_SENDING_POLL_MS = 3000;

export class NewslettersHubStore {
  newsletters: Newsletter[] = [];
  layouts: StudioLayout[] = [];
  inProgress: InProgressOverview | null = null;
  sentOverview: AccountSentOverview | null = null;

  listFetching = false;
  listLoadError: string | null = null;
  inProgressFetching = false;
  sentOverviewFetching = false;

  private listFetchPromise: Promise<void> | null = null;
  private inProgressFetchPromise: Promise<void> | null = null;
  private sentOverviewFetchPromise: Promise<void> | null = null;

  private inProgressPollConsumers = 0;
  private inProgressPollTimer: ReturnType<typeof setInterval> | null = null;
  private listSendingPollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get listShowPlaceholder(): boolean {
    return this.newsletters.length === 0 && this.listFetching;
  }

  get listRefreshing(): boolean {
    return this.newsletters.length > 0 && this.listFetching;
  }

  get inProgressShowPlaceholder(): boolean {
    return this.inProgress === null && this.inProgressFetching;
  }

  get inProgressRefreshing(): boolean {
    return this.inProgress !== null && this.inProgressFetching;
  }

  get sentOverviewShowPlaceholder(): boolean {
    return this.sentOverview === null && this.sentOverviewFetching;
  }

  get sentOverviewRefreshing(): boolean {
    return this.sentOverview !== null && this.sentOverviewFetching;
  }

  get hasSendingNewsletters(): boolean {
    return this.newsletters.some((n) => n.status === "sending");
  }

  getNewsletter(id: string): Newsletter | undefined {
    return this.newsletters.find((n) => n.id === id);
  }

  setLayouts(layouts: StudioLayout[]) {
    this.layouts = layouts;
  }

  upsertNewsletter(newsletter: Newsletter) {
    const idx = this.newsletters.findIndex((n) => n.id === newsletter.id);
    if (idx >= 0) {
      this.newsletters[idx] = newsletter;
    } else {
      this.newsletters = [newsletter, ...this.newsletters];
    }
  }

  removeNewsletter(id: string) {
    this.newsletters = this.newsletters.filter((n) => n.id !== id);
  }

  async refreshList(options?: { force?: boolean }): Promise<void> {
    if (this.listFetchPromise) return this.listFetchPromise;

    const hasCache = this.newsletters.length > 0;
    if (!options?.force && !hasCache && this.listFetching) return this.listFetchPromise ?? Promise.resolve();

    this.listFetching = true;
    this.listFetchPromise = (async () => {
      try {
        const [list, layoutRes] = await Promise.all([
          studioApi.listNewsletters(),
          studioApi.listLayouts(),
        ]);
        runInAction(() => {
          this.newsletters = list.newsletters;
          this.layouts = layoutRes.layouts;
          this.listLoadError = null;
        });
        this.syncListSendingPoll();
      } catch (err) {
        const message = studioLoadErrorMessage(
          err,
          studioUserMessages.loadNewsletters,
        );
        runInAction(() => {
          if (!hasCache) this.listLoadError = message;
        });
        if (!hasCache) throw new Error(message);
      } finally {
        runInAction(() => {
          this.listFetching = false;
          this.listFetchPromise = null;
        });
      }
    })();

    return this.listFetchPromise;
  }

  async refreshInProgress(options?: { force?: boolean }): Promise<void> {
    if (this.inProgressFetchPromise) return this.inProgressFetchPromise;

    this.inProgressFetching = true;
    this.inProgressFetchPromise = (async () => {
      try {
        const data = await studioApi.getInProgressOverview();
        runInAction(() => {
          this.inProgress = data;
        });
      } catch {
        throw new Error("Could not load in-progress newsletters");
      } finally {
        runInAction(() => {
          this.inProgressFetching = false;
          this.inProgressFetchPromise = null;
        });
      }
    })();

    return this.inProgressFetchPromise;
  }

  async refreshSentOverview(options?: { force?: boolean }): Promise<void> {
    if (this.sentOverviewFetchPromise) return this.sentOverviewFetchPromise;

    this.sentOverviewFetching = true;
    this.sentOverviewFetchPromise = (async () => {
      try {
        const data = await studioApi.getSentOverview();
        runInAction(() => {
          this.sentOverview = data;
        });
      } catch {
        throw new Error("Could not load sent statistics");
      } finally {
        runInAction(() => {
          this.sentOverviewFetching = false;
          this.sentOverviewFetchPromise = null;
        });
      }
    })();

    return this.sentOverviewFetchPromise;
  }

  ensureListLoaded() {
    void this.refreshList();
  }

  ensureInProgressLoaded() {
    void this.refreshInProgress();
  }

  ensureSentOverviewLoaded() {
    void this.refreshSentOverview();
  }

  beginInProgressPolling() {
    this.inProgressPollConsumers += 1;
    if (this.inProgressPollTimer !== null) return;
    this.inProgressPollTimer = setInterval(() => {
      void this.refreshInProgress();
    }, IN_PROGRESS_POLL_MS);
  }

  endInProgressPolling() {
    this.inProgressPollConsumers = Math.max(0, this.inProgressPollConsumers - 1);
    if (this.inProgressPollConsumers > 0) return;
    if (this.inProgressPollTimer !== null) {
      clearInterval(this.inProgressPollTimer);
      this.inProgressPollTimer = null;
    }
  }

  private syncListSendingPoll() {
    if (this.hasSendingNewsletters) {
      if (this.listSendingPollTimer !== null) return;
      this.listSendingPollTimer = setInterval(() => {
        void this.refreshList().catch(() => {});
      }, LIST_SENDING_POLL_MS);
      return;
    }
    if (this.listSendingPollTimer !== null) {
      clearInterval(this.listSendingPollTimer);
      this.listSendingPollTimer = null;
    }
  }

  dispose() {
    this.endInProgressPolling();
    this.inProgressPollConsumers = 0;
    if (this.inProgressPollTimer !== null) {
      clearInterval(this.inProgressPollTimer);
      this.inProgressPollTimer = null;
    }
    if (this.listSendingPollTimer !== null) {
      clearInterval(this.listSendingPollTimer);
      this.listSendingPollTimer = null;
    }
  }
}

/** Session cache — survives remounts when switching newsletter routes. */
export const newslettersHubStore = new NewslettersHubStore();
