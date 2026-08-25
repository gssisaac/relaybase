"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { clearEmailCache } from "@/email/components/mailbox/email-cached-fetch";
import type {
  AudienceGroupSummary,
  BroadcastDetail,
  EmailBroadcast,
} from "@/email/components/mailbox/types";
import {
  loadPersistedBroadcastDrafts,
  savePersistedBroadcastDrafts,
  type LocalBroadcastDraft,
} from "@/lib/dashboard/broadcast-drafts-disk";
import { desktopAwareFetch } from "@/lib/desktop/api-base";
import { notifyIfCloudflarePlanError } from "@/lib/cloudflare/CloudflarePlanDialog";

function clearBroadcastCaches(productId: string, broadcastId: string) {
  clearEmailCache(productId, `broadcast:${broadcastId}`);
  clearEmailCache(productId, "broadcasts:all");
}

export type BroadcastJobPhase =
  | "pending"
  | "uploading"
  | "sending"
  | "done"
  | "failed";

export type BroadcastJob = {
  id: string;
  broadcastId: string;
  phase: BroadcastJobPhase;
  message: string | null;
  error: string | null;
  startedAt: number;
};

export type BroadcastQueueInput = {
  broadcastId: string;
  groupIds: string[];
  from: string;
  subject: string;
  body: string;
};

function isInFlightPhase(phase: BroadcastJobPhase): boolean {
  return phase === "pending" || phase === "uploading" || phase === "sending";
}

/**
 * Local broadcast drafts + background send jobs.
 * Drafts live under ~/.relaybase (see broadcast-drafts-disk) — server only
 * receives content when the user hits Broadcast.
 */
export class BroadcastStore {
  drafts: LocalBroadcastDraft[] = [];
  jobs: BroadcastJob[] = [];
  hydrated = false;
  hydrating = false;
  apiBase = "/api/email";
  productId = "";

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  configure(input: { productId: string; apiBase: string }) {
    const nextId = input.productId;
    const nextApi = input.apiBase.replace(/\/$/, "") || "/api/email";
    const productChanged = this.productId !== nextId;
    this.productId = nextId;
    this.apiBase = nextApi;
    if (productChanged) {
      this.drafts = [];
      this.hydrated = false;
      void this.hydrate();
    }
  }

  async hydrate(): Promise<void> {
    if (!this.productId || this.hydrating) return;
    this.hydrating = true;
    try {
      const loaded = await loadPersistedBroadcastDrafts(this.productId);
      runInAction(() => {
        this.drafts = (loaded ?? []).filter((d) => d.status === "draft");
        this.hydrated = true;
      });
    } catch {
      runInAction(() => {
        this.hydrated = true;
      });
    } finally {
      runInAction(() => {
        this.hydrating = false;
      });
    }
  }

  getDraft(id: string): LocalBroadcastDraft | undefined {
    return this.drafts.find((d) => d.id === id);
  }

  detailFromDraft(
    draft: LocalBroadcastDraft,
    groups: AudienceGroupSummary[] = [],
  ): BroadcastDetail {
    const wanted = new Set(draft.groupIds);
    const matched = groups.filter((g) => wanted.has(g.id));
    return {
      broadcast: draft,
      groups: matched,
      recipientCount:
        draft.recipientCount ??
        matched.reduce((sum, g) => sum + g.contactCount, 0),
    };
  }

  createDraft(input: {
    groupIds: string[];
    domain?: string;
    from?: string;
    recipientCount?: number;
  }): LocalBroadcastDraft {
    const now = new Date().toISOString();
    const groupIds = Array.from(new Set(input.groupIds.filter(Boolean)));
    const draft: LocalBroadcastDraft = {
      id: crypto.randomUUID(),
      subject: "",
      body: "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
      groupIds,
      domain: input.domain,
      from: input.from,
      recipientCount: input.recipientCount ?? 0,
    };
    this.drafts = [draft, ...this.drafts];
    void this.persistDrafts();
    return draft;
  }

  /** Import a legacy server draft into local storage (once). */
  importServerDraft(broadcast: EmailBroadcast): LocalBroadcastDraft {
    const existing = this.getDraft(broadcast.id);
    if (existing) return existing;
    const now = new Date().toISOString();
    const draft: LocalBroadcastDraft = {
      id: broadcast.id,
      subject: broadcast.subject ?? "",
      body: broadcast.body ?? "",
      from: broadcast.from,
      status: "draft",
      createdAt: broadcast.createdAt || now,
      updatedAt: now,
      groupIds: broadcast.groupIds ?? [],
      domain: broadcast.domain,
      recipientCount: broadcast.recipientCount ?? 0,
    };
    this.drafts = [draft, ...this.drafts];
    void this.persistDrafts();
    return draft;
  }

  /** Create or update a local draft so Unsend can restore compose fields. */
  persistQueueInput(input: BroadcastQueueInput) {
    const updated = this.upsertDraft({
      id: input.broadcastId,
      groupIds: input.groupIds,
      from: input.from,
      subject: input.subject,
      body: input.body,
    });
    if (updated) return updated;
    const now = new Date().toISOString();
    const draft: LocalBroadcastDraft = {
      id: input.broadcastId,
      subject: input.subject,
      body: input.body,
      from: input.from,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      groupIds: input.groupIds,
      recipientCount: 0,
    };
    this.drafts = [draft, ...this.drafts];
    void this.persistDrafts();
    return draft;
  }

  upsertDraft(patch: {
    id: string;
    groupIds?: string[];
    from?: string;
    subject?: string;
    body?: string;
    domain?: string;
    recipientCount?: number;
  }): LocalBroadcastDraft | null {
    const existing = this.getDraft(patch.id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const next: LocalBroadcastDraft = {
      ...existing,
      groupIds:
        patch.groupIds !== undefined
          ? Array.from(new Set(patch.groupIds.filter(Boolean)))
          : existing.groupIds,
      from: patch.from !== undefined ? patch.from : existing.from,
      subject: patch.subject !== undefined ? patch.subject : existing.subject,
      body: patch.body !== undefined ? patch.body : existing.body,
      domain: patch.domain !== undefined ? patch.domain : existing.domain,
      recipientCount:
        patch.recipientCount !== undefined
          ? patch.recipientCount
          : existing.recipientCount,
      updatedAt: now,
      status: "draft",
    };
    this.drafts = this.drafts.map((d) => (d.id === next.id ? next : d));
    void this.persistDrafts();
    return next;
  }

  removeDraft(id: string) {
    const next = this.drafts.filter((d) => d.id !== id);
    if (next.length === this.drafts.length) return;
    this.drafts = next;
    void this.persistDrafts();
  }

  jobFor(broadcastId: string): BroadcastJob | undefined {
    return this.jobs.find((j) => j.broadcastId === broadcastId);
  }

  isActive(broadcastId: string): boolean {
    const job = this.jobFor(broadcastId);
    return Boolean(job && isInFlightPhase(job.phase));
  }

  /**
   * Hold a send in the Unsend window. Persists local draft fields and creates
   * a pending job — no network until `queueBroadcast`.
   */
  armBroadcast(input: BroadcastQueueInput): BroadcastJob {
    const existing = this.jobFor(input.broadcastId);
    this.persistQueueInput(input);
    if (existing && isInFlightPhase(existing.phase)) {
      return existing;
    }

    const job: BroadcastJob = {
      id: crypto.randomUUID(),
      broadcastId: input.broadcastId,
      phase: "pending",
      message: "Starting broadcast…",
      error: null,
      startedAt: Date.now(),
    };
    this.jobs = [
      job,
      ...this.jobs.filter((j) => j.broadcastId !== input.broadcastId),
    ];
    return job;
  }

  /** Cancel a pending Unsend window. No-op once upload/send has started. */
  cancelArmed(broadcastId: string) {
    const job = this.jobFor(broadcastId);
    if (!job || job.phase !== "pending") return;
    this.dismissJob(broadcastId);
  }

  /**
   * Push local draft to the server and send in the background.
   * Commits a pending job from `armBroadcast`, or starts a new one.
   * Returns immediately — caller should navigate to Progress.
   */
  queueBroadcast(input: BroadcastQueueInput): BroadcastJob {
    const existing = this.jobFor(input.broadcastId);
    if (
      existing &&
      (existing.phase === "uploading" || existing.phase === "sending")
    ) {
      return existing;
    }

    this.persistQueueInput(input);

    if (existing?.phase === "pending") {
      existing.phase = "uploading";
      existing.message = "Starting broadcast…";
      existing.error = null;
      existing.startedAt = Date.now();
      void this.runJob(existing, input);
      return existing;
    }

    const job: BroadcastJob = {
      id: crypto.randomUUID(),
      broadcastId: input.broadcastId,
      phase: "uploading",
      message: "Starting broadcast…",
      error: null,
      startedAt: Date.now(),
    };
    this.jobs = [
      job,
      ...this.jobs.filter((j) => j.broadcastId !== input.broadcastId),
    ];
    void this.runJob(job, input);
    return job;
  }

  dismissJob(broadcastId: string) {
    this.jobs = this.jobs.filter((j) => j.broadcastId !== broadcastId);
  }

  private async persistDrafts() {
    if (!this.productId) return;
    try {
      await savePersistedBroadcastDrafts(this.productId, this.drafts);
    } catch {
      // Disk write failures surface on next hydrate; keep in-memory.
    }
  }

  private async runJob(job: BroadcastJob, input: BroadcastQueueInput) {
    const { broadcastId } = input;
    try {
      // Upsert onto the server only at send time (not while drafting).
      const upsertRes = await desktopAwareFetch(`${this.apiBase}/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: broadcastId,
          groupIds: input.groupIds,
          from: input.from || undefined,
          subject: input.subject,
          text: input.body,
          status: "draft",
        }),
      });
      const upsertData = (await upsertRes.json()) as { error?: string };
      if (!upsertRes.ok) {
        throw new Error(upsertData.error ?? "Failed to start broadcast");
      }

      runInAction(() => {
        job.phase = "sending";
        job.message = "Broadcasting…";
        job.error = null;
      });

      if (this.productId) {
        clearBroadcastCaches(this.productId, broadcastId);
      }

      const sendRes = await desktopAwareFetch(
        `${this.apiBase}/broadcasts/${encodeURIComponent(broadcastId)}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: input.from || undefined,
            groupIds: input.groupIds,
            subject: input.subject,
            text: input.body,
          }),
        },
      );
      const sendData = (await sendRes.json()) as {
        error?: string;
        code?: string;
      };
      if (!sendRes.ok) {
        if (notifyIfCloudflarePlanError(sendData)) {
          throw new Error(
            "Sending requires a Cloudflare Workers Paid plan (~$5/mo, billed by Cloudflare).",
          );
        }
        throw new Error(sendData.error ?? "Broadcast failed");
      }

      runInAction(() => {
        job.phase = "done";
        job.message = "Broadcast sent";
        job.error = null;
        this.removeDraft(broadcastId);
      });
      if (this.productId) {
        clearBroadcastCaches(this.productId, broadcastId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Broadcast failed";
      runInAction(() => {
        job.phase = "failed";
        job.message = null;
        job.error = message;
      });
      if (this.productId) {
        clearBroadcastCaches(this.productId, broadcastId);
      }
    }
  }
}
