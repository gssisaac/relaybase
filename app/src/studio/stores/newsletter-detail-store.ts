"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { syncStudioSendCredentials } from "@/studio/lib/sync-studio-send-credentials";
import {
  studioApi,
  StudioApiError,
  type Newsletter,
  type NewsletterDispatchProgress,
  type NewsletterLinkClickStat,
  type NewsletterMember,
  type NewsletterRecipient,
  type NewsletterTrackingEvent,
  type StudioLayout,
} from "@/lib/studio/api";

export type NewsletterDraftFields = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
  messageId: string | null;
};

const STATS_POLL_MS = 3000;

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "").trim() !== (b[key] ?? "").trim()) return false;
  }
  return true;
}

export class NewsletterDetailStore {
  newsletterId = "";
  newsletter: Newsletter | null = null;
  templates: StudioLayout[] = [];
  audienceMembers: NewsletterMember[] = [];
  loading = true;
  notFound = false;

  recipients: NewsletterRecipient[] = [];
  trackingEvents: NewsletterTrackingEvent[] = [];
  linkClicks: NewsletterLinkClickStat[] = [];
  dispatch: NewsletterDispatchProgress | null = null;

  sendInFlight = false;
  sendError: string | null = null;

  private draft: NewsletterDraftFields = {
    subject: "",
    bodyMarkdown: "",
    templateId: "",
    templateVariables: {},
    messageId: null,
  };
  private lastSavedDraft: NewsletterDraftFields | null = null;
  private persistInFlight: Promise<boolean> | null = null;
  private statsPollTimer: ReturnType<typeof setInterval> | null = null;
  private statsPollGeneration = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  mount(newsletterId: string): void {
    if (this.newsletterId === newsletterId && this.newsletter && !this.loading) {
      this.syncStatsPolling();
      return;
    }
    this.unmount();
    this.newsletterId = newsletterId;
    this.loading = true;
    this.notFound = false;
    this.lastSavedDraft = null;
    void this.refresh();
  }

  unmount(): void {
    this.stopStatsPolling();
    this.statsPollGeneration += 1;
  }

  setNewsletter(newsletter: Newsletter): void {
    this.newsletter = newsletter;
    this.syncStatsPolling();
  }

  syncDraft(fields: NewsletterDraftFields): void {
    this.draft = fields;
  }

  getLastSavedDraft(): NewsletterDraftFields {
    return this.lastSavedDraft ?? this.draft;
  }

  async refresh(): Promise<void> {
    const id = this.newsletterId;
    if (!id) return;
    try {
      const [b, t] = await Promise.all([studioApi.getNewsletter(id), studioApi.listLayouts()]);
      runInAction(() => {
        this.newsletter = b;
        this.templates = t.layouts;
        this.notFound = false;
        const fields: NewsletterDraftFields = {
          subject: b.subject,
          bodyMarkdown: b.bodyMarkdown,
          templateId: b.layoutId ?? "",
          templateVariables: b.templateVariables ?? {},
          messageId: b.messageId ?? null,
        };
        this.draft = fields;
        this.lastSavedDraft = fields;
      });
      try {
        await this.refreshAudience();
      } catch {
        runInAction(() => {
          this.audienceMembers = [];
        });
      }
      this.syncStatsPolling();
      if (this.newsletter && this.newsletter.status !== "draft") {
        void this.loadStats();
      }
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      runInAction(() => {
        if (status === 404) this.notFound = true;
        this.newsletter = null;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async refreshTemplates(): Promise<void> {
    const t = await studioApi.listLayouts();
    runInAction(() => {
      this.templates = t.layouts;
    });
  }

  async refreshAudience(): Promise<void> {
    const { members } = await studioApi.listNewsletterAudience(this.newsletterId);
    runInAction(() => {
      this.audienceMembers = members;
    });
  }

  persistDraft(): Promise<boolean> {
    const current = this.newsletter;
    if (!current || current.status !== "draft") return Promise.resolve(true);
    if (this.persistInFlight) return this.persistInFlight;

    const next = this.draft;
    const prev = this.lastSavedDraft;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId &&
      prev.messageId === next.messageId &&
      templateVariablesEqual(prev.templateVariables, next.templateVariables)
    ) {
      return Promise.resolve(true);
    }

    const run = studioApi
      .updateNewsletter(this.newsletterId, {
        subject: next.subject,
        bodyMarkdown: next.bodyMarkdown,
        layoutId: next.templateId,
        templateVariables: next.templateVariables,
        messageId: next.messageId,
      })
      .then((updated) => {
        runInAction(() => {
          this.lastSavedDraft = next;
          this.newsletter = updated;
        });
        return true;
      })
      .catch(() => false)
      .finally(() => {
        this.persistInFlight = null;
      });
    this.persistInFlight = run;
    return run;
  }

  async loadStats(): Promise<void> {
    const id = this.newsletterId;
    if (!id) return;
    try {
      const data = await studioApi.getNewsletterStats(id);
      runInAction(() => {
        this.newsletter = data.newsletter;
        this.dispatch = data.dispatch;
        this.recipients = data.recipients;
        this.trackingEvents = data.trackingEvents;
        this.linkClicks = data.linkClicks;
      });
      this.syncStatsPolling();
    } catch {
      // stats tab can retry on next poll
    }
  }

  private syncStatsPolling(): void {
    if (this.newsletter?.status === "sending") {
      this.startStatsPolling();
    } else {
      this.stopStatsPolling();
    }
  }

  private startStatsPolling(): void {
    if (this.statsPollTimer) return;
    const generation = this.statsPollGeneration;
    void this.loadStats();
    this.statsPollTimer = setInterval(() => {
      if (generation !== this.statsPollGeneration) return;
      void this.loadStats();
    }, STATS_POLL_MS);
  }

  private stopStatsPolling(): void {
    if (this.statsPollTimer) {
      clearInterval(this.statsPollTimer);
      this.statsPollTimer = null;
    }
  }

  /**
   * Flush draft, sync Worker send credentials, start send, and poll stats.
   * Optimistically moves to `sending` so UI can navigate away immediately.
   */
  async sendNewsletter(input: { apiBase: string; sendingDomain: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const current = this.newsletter;
    if (!current || current.status !== "draft") {
      return { ok: false, error: "Newsletter is not a draft" };
    }

    runInAction(() => {
      this.sendInFlight = true;
      this.sendError = null;
      this.newsletter = { ...current, status: "sending" };
    });
    this.syncStatsPolling();

    try {
      const saved = await this.persistDraft();
      if (!saved) {
        throw new Error("Could not save newsletter");
      }

      const domain = input.sendingDomain.trim();
      if (!domain) {
        throw new Error("Select a sending domain on Settings before sending.");
      }

      await syncStudioSendCredentials({ apiBase: input.apiBase, sendingDomain: domain });

      const result = await studioApi.sendNewsletter(this.newsletterId);
      runInAction(() => {
        this.newsletter = result.newsletter;
      });
      void this.loadStats();
      this.syncStatsPolling();
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof StudioApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Send failed";
      runInAction(() => {
        this.sendError = message;
        if (this.newsletter?.status === "sending") {
          this.newsletter = { ...this.newsletter, status: "draft" };
        }
      });
      this.syncStatsPolling();
      return { ok: false, error: message };
    } finally {
      runInAction(() => {
        this.sendInFlight = false;
      });
    }
  }

  async testSendNewsletter(input: {
    apiBase: string;
    sendingDomain: string;
    to: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const saved = await this.persistDraft();
      if (!saved) return { ok: false, error: "Could not save newsletter" };
      const domain = input.sendingDomain.trim();
      if (!domain) {
        return { ok: false, error: "Select a sending domain on Settings before sending." };
      }
      await syncStudioSendCredentials({ apiBase: input.apiBase, sendingDomain: domain });
      await studioApi.testSendNewsletter(this.newsletterId, input.to);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      return { ok: false, error: message };
    }
  }

  async scheduleNewsletter(input: {
    apiBase: string;
    sendingDomain: string;
    runAt: string;
  }): Promise<{ ok: true; newsletter: Newsletter } | { ok: false; error: string }> {
    try {
      const saved = await this.persistDraft();
      if (!saved) return { ok: false, error: "Could not save newsletter" };
      const domain = input.sendingDomain.trim();
      if (!domain) {
        return { ok: false, error: "Select a sending domain on Settings before sending." };
      }
      await syncStudioSendCredentials({ apiBase: input.apiBase, sendingDomain: domain });
      const updated = await studioApi.scheduleNewsletter(this.newsletterId, input.runAt);
      runInAction(() => {
        this.newsletter = updated;
      });
      return { ok: true, newsletter: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not schedule";
      return { ok: false, error: message };
    }
  }

  async cancelSchedule(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const updated = await studioApi.cancelSchedule(this.newsletterId);
      runInAction(() => {
        this.newsletter = updated;
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cannot cancel schedule";
      return { ok: false, error: message };
    }
  }

  async updateAudienceGroup(audienceGroupId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const updated = await studioApi.updateNewsletter(this.newsletterId, { audienceGroupId });
      runInAction(() => {
        this.newsletter = updated;
      });
      await this.refreshAudience();
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof StudioApiError ? err.message : "Could not update audience";
      return { ok: false, error: message };
    }
  }
}
