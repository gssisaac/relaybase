"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  collectTransferFiles,
  optimizeImageForEmail,
} from "@/email/lib/attachments/image-optimize";
import type { FeedbackAccountContext } from "@/lib/feedback/feedback-account";
import {
  clearAllFeedbackDraftBytes,
  deleteFeedbackDraftBytes,
  readFeedbackDraftBytes,
  writeFeedbackDraftBytes,
} from "@/lib/feedback/feedback-draft-idb";
import {
  MAX_FEEDBACK_IMAGE_BYTES,
  MAX_FEEDBACK_IMAGES,
} from "@/lib/feedback/feedback-limits";

const STORAGE_KEY = "relaybase:feedback-draft:v1";

export type FeedbackDraftAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

type PersistedDraft = {
  v: 1;
  message: string;
  contactEmail: string;
  attachments: FeedbackDraftAttachment[];
};

function slugFilename(name: string): string {
  const trimmed = name.trim() || "image.png";
  return trimmed.replace(/[^\p{L}\p{N}.\-()+ ]+/gu, "_").slice(0, 120);
}

function readPersistedDraft(): PersistedDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (parsed.v !== 1) return null;
    return {
      v: 1,
      message: typeof parsed.message === "string" ? parsed.message : "",
      contactEmail:
        typeof parsed.contactEmail === "string" ? parsed.contactEmail : "",
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
    };
  } catch {
    return null;
  }
}

function writePersistedDraft(draft: PersistedDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }
}

function clearPersistedDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export class FeedbackDraftStore {
  dialogOpen = false;
  message = "";
  contactEmail = "";
  attachments: FeedbackDraftAttachment[] = [];
  previewUrls: Record<string, string | null> = {};
  attachmentError: string | null = null;
  submitting = false;
  hydrated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    void this.hydrate();
  }

  get hasDraft(): boolean {
    return (
      Boolean(this.message.trim()) ||
      Boolean(this.contactEmail.trim()) ||
      this.attachments.length > 0
    );
  }

  openDialog() {
    this.dialogOpen = true;
  }

  setDialogOpen(open: boolean) {
    this.dialogOpen = open;
  }

  setMessage(value: string) {
    this.message = value;
    this.persistMeta();
  }

  setContactEmail(value: string) {
    this.contactEmail = value;
    this.persistMeta();
  }

  private persistMeta() {
    if (!this.hydrated) return;
    writePersistedDraft({
      v: 1,
      message: this.message,
      contactEmail: this.contactEmail,
      attachments: this.attachments,
    });
  }

  private revokePreview(id: string) {
    const url = this.previewUrls[id];
    if (url) URL.revokeObjectURL(url);
    delete this.previewUrls[id];
  }

  private async refreshPreview(id: string) {
    const bytes = await readFeedbackDraftBytes(id);
    if (!bytes) {
      runInAction(() => {
        this.revokePreview(id);
        this.previewUrls[id] = null;
      });
      return;
    }
    const att = this.attachments.find((a) => a.id === id);
    const blob = new Blob([bytes], {
      type: att?.contentType ?? "image/png",
    });
    const url = URL.createObjectURL(blob);
    runInAction(() => {
      this.revokePreview(id);
      this.previewUrls[id] = url;
    });
  }

  async hydrate() {
    const saved = readPersistedDraft();
    if (saved) {
      runInAction(() => {
        this.message = saved.message;
        this.contactEmail = saved.contactEmail;
        this.attachments = saved.attachments.slice(0, MAX_FEEDBACK_IMAGES);
      });
      for (const att of this.attachments) {
        await this.refreshPreview(att.id);
      }
    }
    runInAction(() => {
      this.hydrated = true;
    });
  }

  async addFromTransfer(data: DataTransfer | null) {
    const files = collectTransferFiles(data).filter((file) =>
      (file.type || "").startsWith("image/"),
    );
    if (!files.length) return;
    await this.addFiles(files);
  }

  async addFiles(files: File[]) {
    this.attachmentError = null;
    if (!files.length) return;

    if (this.attachments.length + files.length > MAX_FEEDBACK_IMAGES) {
      this.attachmentError = `Maximum ${MAX_FEEDBACK_IMAGES} images.`;
      return;
    }

    for (const file of files) {
      const optimized = await optimizeImageForEmail(file);
      const blob = optimized?.blob ?? file;
      const contentType =
        optimized?.mimeType ?? (file.type || "image/png");
      const filename = slugFilename(optimized?.filename ?? file.name);
      const bytes = await blob.arrayBuffer();
      if (bytes.byteLength > MAX_FEEDBACK_IMAGE_BYTES) {
        this.attachmentError = "Image too large (max 2 MB each).";
        continue;
      }
      const id = crypto.randomUUID().slice(0, 12);
      await writeFeedbackDraftBytes(id, bytes);
      runInAction(() => {
        this.attachments.push({
          id,
          filename,
          contentType,
          size: bytes.byteLength,
        });
      });
      await this.refreshPreview(id);
      this.persistMeta();
    }
  }

  async removeAttachment(id: string) {
    this.revokePreview(id);
    await deleteFeedbackDraftBytes(id);
    runInAction(() => {
      this.attachments = this.attachments.filter((a) => a.id !== id);
      this.attachmentError = null;
    });
    this.persistMeta();
  }

  async clearDraft() {
    for (const att of this.attachments) {
      this.revokePreview(att.id);
    }
    await clearAllFeedbackDraftBytes();
    runInAction(() => {
      this.message = "";
      this.contactEmail = "";
      this.attachments = [];
      this.previewUrls = {};
      this.attachmentError = null;
    });
    clearPersistedDraft();
  }

  async submit(input: {
    pagePath: string;
    account: FeedbackAccountContext;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmed = this.message.trim();
    if (!trimmed) {
      return { ok: false, error: "Please enter your feedback" };
    }
    if (this.attachmentError) {
      return { ok: false, error: this.attachmentError };
    }

    this.submitting = true;
    try {
      const feedbackId = crypto.randomUUID();
      const uploaded: {
        key: string;
        filename: string;
        contentType: string;
        size: number;
      }[] = [];

      for (const att of this.attachments) {
        const bytes = await readFeedbackDraftBytes(att.id);
        if (!bytes) continue;
        const form = new FormData();
        form.append("feedbackId", feedbackId);
        form.append("attachmentId", att.id);
        form.append(
          "file",
          new Blob([bytes], { type: att.contentType }),
          att.filename,
        );
        const res = await fetch("/api/feedback/upload", {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          key?: string;
          filename?: string;
          contentType?: string;
          size?: number;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.key) {
          throw new Error(data.error ?? "Could not upload image");
        }
        uploaded.push({
          key: data.key,
          filename: data.filename ?? att.filename,
          contentType: data.contentType ?? att.contentType,
          size: data.size ?? att.size,
        });
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: feedbackId,
          message: trimmed,
          contactEmail: this.contactEmail.trim() || undefined,
          pagePath: input.pagePath,
          account: input.account,
          images: uploaded.length ? uploaded : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not send feedback");
      }

      await this.clearDraft();
      runInAction(() => {
        this.dialogOpen = false;
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not send feedback",
      };
    } finally {
      runInAction(() => {
        this.submitting = false;
      });
    }
  }
}

let singleton: FeedbackDraftStore | null = null;

export function getFeedbackDraftStore(): FeedbackDraftStore {
  if (!singleton) singleton = new FeedbackDraftStore();
  return singleton;
}
