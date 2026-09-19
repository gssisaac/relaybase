import { sanitizeFeedbackAccount, type FeedbackAccountContext } from "@/lib/feedback/feedback-account";

export type FeedbackImageRef = {
  key: string;
  filename: string;
  contentType: string;
  size: number;
};

export type FeedbackRecord = {
  id: string;
  message: string;
  contactEmail?: string;
  pagePath?: string;
  userAgent?: string;
  createdAt: string;
  account?: FeedbackAccountContext;
  images?: FeedbackImageRef[];
};

export function feedbackKvKey(id: string, createdAt: string): string {
  const day = createdAt.slice(0, 10);
  return `feedback/${day}/${id}`;
}

export function feedbackR2ObjectKey(
  feedbackId: string,
  attachmentId: string,
  filename: string,
  createdAt: string,
): string {
  const day = createdAt.slice(0, 10);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `uploads/${day}/${feedbackId}/${attachmentId}/${safeName}`;
}

function parseImages(raw: unknown): FeedbackImageRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: FeedbackImageRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    const filename = typeof o.filename === "string" ? o.filename.trim() : "";
    const contentType =
      typeof o.contentType === "string" ? o.contentType.trim() : "";
    const size = typeof o.size === "number" ? o.size : 0;
    if (!key || !filename || !contentType || size <= 0) continue;
    out.push({ key, filename, contentType, size });
    if (out.length >= 5) break;
  }
  return out.length ? out : undefined;
}

export function parseFeedbackBody(body: unknown): {
  id?: string;
  message: string;
  contactEmail?: string;
  pagePath?: string;
  account?: FeedbackAccountContext;
  images?: FeedbackImageRef[];
} | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (message.length < 1 || message.length > 8000) return null;
  const contactEmail =
    typeof raw.contactEmail === "string" && raw.contactEmail.trim()
      ? raw.contactEmail.trim().slice(0, 320)
      : undefined;
  const pagePath =
    typeof raw.pagePath === "string" && raw.pagePath.trim()
      ? raw.pagePath.trim().slice(0, 512)
      : undefined;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim().slice(0, 64)
      : undefined;
  const account = sanitizeFeedbackAccount(raw.account);
  const images = parseImages(raw.images);
  return { id, message, contactEmail, pagePath, account, images };
}
