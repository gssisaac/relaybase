"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { syncStudioSendCredentials } from "@/studio/lib/send/sync-studio-send-credentials";
import { newslettersHubStore } from "@/studio/stores/newsletters-hub";
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
} from "@/studio/api";

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
  subscriberMembers: NewsletterMember[] = [];
  loading = true;
  refreshing = false;
  notFound = false;

  recipients: NewsletterRecipient[] = [];
  trackingEvents: NewsletterTrackingEvent[] = [];
  linkClicks: NewsletterLinkClickStat[] = [];
  dispatch: NewsletterDispatchProgress | null = null;

  sendInFlight = false;
  sendError: string | null = null;

  draftSubject = "";
  draftBody = "";
  draftTemplateId = "";
  draftTemplateVariables: Record<string, string> = {};
  draftMessageId: string | null = null;

  private lastSavedSubject = "";
  private lastSavedBody = "";
  private lastSavedTemplateId = "";
  private lastSavedTemplateVariables: Record<string, string> = {};
  private lastSavedMessageId: string | null = null;

  private activePollNewsletterId: string | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private persistPromise: Promise<boolean> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isDirty(): boolean {
    return (
      this.draftSubject !== this.lastSavedSubject ||
      this.draftBody !== this.lastSavedBody ||
      this.draftTemplateId !== this.lastSavedTemplateId ||
      this.draftMessageId !== this.lastSavedMessageId ||
      !templateVariablesEqual(this.draftTemplateVariables, this.lastSavedTemplateVariables)
    );
  }

  get isTerminal(): boolean {
    const s = this.newsletter?.status;
    return s === "sent" || s === "failed";
  }

  get isSending(): boolean {
    return this.newsletter?.status === "sending";
  }

  getLastSavedDraft(): NewsletterDraftFields {
    return {
      subject: this.lastSavedSubject,
      bodyMarkdown: this.lastSavedBody,
      templateId: this.lastSavedTemplateId,
      templateVariables: { ...this.lastSavedTemplateVariables },
      messageId: this.lastSavedMessageId,
    };
  }

  mount(newsletterId: string) {
    if (this.newsletterId === newsletterId) return;
    this.stopPolling();
    this.newsletterId = newsletterId;
    this.notFound = false;

    const cached = newslettersHubStore.getNewsletter(newsletterId);
    if (newslettersHubStore.layouts.length > 0) {
      this.templates = newslettersHubStore.layouts;
    }
    if (cached) {
      this.newsletter = cached;
      this.loading = false;
      this.refreshing = true;
      this.seedDraft(cached);
    } else {
      this.newsletter = null;
      this.loading = true;
      this.refreshing = false;
    }
    this.recipients = [];
    this.trackingEvents = [];
    this.linkClicks = [];
    this.dispatch = null;
    this.sendError = null;

    void this.refresh();
    void this.refreshTemplates();
    void this.refreshSubscribers();
  }

  unmount() {
    this.stopPolling();
    this.newsletterId = "";
    this.newsletter = null;
  }

  setNewsletter(n: Newsletter) {
    this.newsletter = n;
    this.seedDraft(n);
    newslettersHubStore.upsertNewsletter(n);
  }

  private seedDraft(n: Newsletter) {
    this.draftSubject = n.subject ?? "";
    this.draftBody = n.bodyMarkdown ?? "";
    this.draftTemplateId = n.layoutId ?? "";
    this.draftTemplateVariables = { ...(n.templateVariables ?? {}) };
    this.draftMessageId = n.messageId ?? null;

    this.lastSavedSubject = this.draftSubject;
    this.lastSavedBody = this.draftBody;
    this.lastSavedTemplateId = this.draftTemplateId;
    this.lastSavedTemplateVariables = { ...this.draftTemplateVariables };
    this.lastSavedMessageId = this.draftMessageId;
  }

  syncDraft(fields: NewsletterDraftFields) {
    this.draftSubject = fields.subject;
    this.draftBody = fields.bodyMarkdown;
    this.draftTemplateId = fields.templateId;
    this.draftTemplateVariables = { ...fields.templateVariables };
    this.draftMessageId = fields.messageId;
  }

  async persistDraft(): Promise<boolean> {
    if (!this.newsletterId || !this.isDirty) return true;
    if (this.persistPromise) return this.persistPromise;

    const patch: Parameters<typeof studioApi.updateNewsletter>[1] = {
      subject: this.draftSubject,
      bodyMarkdown: this.draftBody,
      layoutId: this.draftTemplateId || null,
      templateVariables: this.draftTemplateVariables,
      messageId: this.draftMessageId,
    };

    const run = async (): Promise<boolean> => {
      try {
        const updated = await studioApi.updateNewsletter(this.newsletterId, patch);
        runInAction(() => {
          this.newsletter = updated;
          newslettersHubStore.upsertNewsletter(updated);
          this.lastSavedSubject = this.draftSubject;
          this.lastSavedBody = this.draftBody;
          this.lastSavedTemplateId = this.draftTemplateId;
          this.lastSavedTemplateVariables = { ...this.draftTemplateVariables };
          this.lastSavedMessageId = this.draftMessageId;
        });
        return true;
      } catch {
        return false;
      } finally {
        this.persistPromise = null;
      }
    };

    this.persistPromise = run();
    return this.persistPromise;
  }

  async refresh(): Promise<void> {
    if (!this.newsletterId) return;
    const hadNewsletter = this.newsletter !== null;
    if (hadNewsletter) {
      this.refreshing = true;
    }
    try {
      const data = await studioApi.getNewsletter(this.newsletterId);
      runInAction(() => {
        this.newsletter = data;
        this.loading = false;
        this.refreshing = false;
        this.notFound = false;
        this.seedDraft(data);
        newslettersHubStore.upsertNewsletter(data);
      });
      if (data.status === "sending") {
        this.startPolling();
      } else if (data.status === "sent" || data.status === "failed") {
        void this.fetchStatsOnce();
      }
    } catch (err) {
      runInAction(() => {
        this.loading = false;
        this.refreshing = false;
        if (err instanceof StudioApiError && err.status === 404) {
          this.notFound = true;
        }
      });
    }
  }

  async refreshTemplates(): Promise<void> {
    if (newslettersHubStore.layouts.length > 0) {
      this.templates = newslettersHubStore.layouts;
    }
    try {
      const { layouts } = await studioApi.listLayouts();
      runInAction(() => {
        this.templates = layouts;
        newslettersHubStore.setLayouts(layouts);
      });
    } catch {
      // Non-fatal
    }
  }

  async refreshSubscribers(): Promise<void> {
    if (!this.newsletterId) return;
    try {
      const { members } = await studioApi.listNewsletterSubscribers(this.newsletterId);
      runInAction(() => {
        this.subscriberMembers = members.map((member) => ({
          ...member,
          newsletterId:
            member.newsletterId ??
            (member as NewsletterMember & { broadcastId?: string }).broadcastId ??
            this.newsletterId,
        }));
      });
    } catch {
      // Non-fatal
    }
  }

  async updateSubscriberGroup(groupId: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.newsletterId) return { ok: false, error: "No newsletter loaded" };
    try {
      const updated = await studioApi.updateNewsletter(this.newsletterId, { subscriberGroupId: groupId });
      runInAction(() => {
        this.newsletter = updated;
        newslettersHubStore.upsertNewsletter(updated);
      });
      await this.refreshSubscribers();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to update subscriber group" };
    }
  }

  async sendNewsletter(input: {
    apiBase: string;
    sendingDomain: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.newsletterId || this.sendInFlight) return { ok: false };
    this.sendInFlight = true;
    this.sendError = null;

    try {
      await syncStudioSendCredentials(input);
      const res = await studioApi.sendNewsletter(this.newsletterId);
      runInAction(() => {
        this.newsletter = res.newsletter;
        newslettersHubStore.upsertNewsletter(res.newsletter);
        this.sendInFlight = false;
      });
      this.startPolling();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      runInAction(() => {
        this.sendError = msg;
        this.sendInFlight = false;
      });
      return { ok: false, error: msg };
    }
  }

  async testSendNewsletter(input: {
    apiBase: string;
    sendingDomain: string;
    to: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.newsletterId) return { ok: false, error: "No newsletter loaded" };
    try {
      await syncStudioSendCredentials(input);
      await studioApi.testSendNewsletter(this.newsletterId, input.to);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Test send failed" };
    }
  }

  async scheduleNewsletter(input: {
    apiBase: string;
    sendingDomain: string;
    runAt: string;
  }): Promise<{ ok: true; newsletter: Newsletter } | { ok: false; error: string }> {
    if (!this.newsletterId) return { ok: false, error: "No newsletter loaded" };
    try {
      await syncStudioSendCredentials(input);
      const updated = await studioApi.scheduleNewsletter(this.newsletterId, input.runAt);
      runInAction(() => {
        this.newsletter = updated;
        newslettersHubStore.upsertNewsletter(updated);
      });
      return { ok: true, newsletter: updated };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Schedule failed" };
    }
  }

  async sendNow(input?: {
    apiBase: string;
    sendingDomain: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (input) {
      return this.sendNewsletter(input);
    }
    if (!this.newsletterId || this.sendInFlight) return { ok: false };
    this.sendInFlight = true;
    this.sendError = null;

    try {
      const res = await studioApi.sendNewsletter(this.newsletterId);
      runInAction(() => {
        this.newsletter = res.newsletter;
        newslettersHubStore.upsertNewsletter(res.newsletter);
        this.sendInFlight = false;
      });
      this.startPolling();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      runInAction(() => {
        this.sendError = msg;
        this.sendInFlight = false;
      });
      return { ok: false, error: msg };
    }
  }

  async cancelSchedule(): Promise<{ ok: boolean; error?: string }> {
    if (!this.newsletterId) return { ok: false };
    try {
      const updated = await studioApi.cancelSchedule(this.newsletterId);
      runInAction(() => {
        this.newsletter = updated;
        newslettersHubStore.upsertNewsletter(updated);
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Cancel failed" };
    }
  }

  startPolling() {
    if (this.activePollNewsletterId === this.newsletterId && this.statsTimer !== null) return;
    this.stopPolling();
    this.activePollNewsletterId = this.newsletterId;

    void this.fetchStatsOnce();
    this.statsTimer = setInterval(() => {
      void this.pollTick();
    }, STATS_POLL_MS);
  }

  stopPolling() {
    if (this.statsTimer !== null) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.activePollNewsletterId = null;
  }

  private async pollTick() {
    if (!this.newsletterId) return;
    try {
      const data = await studioApi.getNewsletterStats(this.newsletterId);
      runInAction(() => {
        this.newsletter = data.newsletter;
        newslettersHubStore.upsertNewsletter(data.newsletter);
        this.dispatch = data.dispatch;
        this.recipients = data.recipients;
        this.trackingEvents = data.trackingEvents;
        this.linkClicks = data.linkClicks;
      });
      if (data.newsletter.status === "sent" || data.newsletter.status === "failed") {
        this.stopPolling();
      }
    } catch {
      // Non-fatal poll failure
    }
  }

  private async fetchStatsOnce() {
    if (!this.newsletterId) return;
    try {
      const data = await studioApi.getNewsletterStats(this.newsletterId);
      runInAction(() => {
        this.newsletter = data.newsletter;
        newslettersHubStore.upsertNewsletter(data.newsletter);
        this.dispatch = data.dispatch;
        this.recipients = data.recipients;
        this.trackingEvents = data.trackingEvents;
        this.linkClicks = data.linkClicks;
      });
    } catch {
      // Non-fatal
    }
  }
}
