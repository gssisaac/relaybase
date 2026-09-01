"use client";

import type { DraftAttachment } from "@/email/components/mailbox/types";
import {
  saveDraftAttachmentBytes,
} from "@/email/lib/attachments/draft-attachment-store";
import {
  MAX_ATTACHMENT_COUNT,
  totalAttachmentBytes,
  MAX_STAGED_ATTACHMENTS_BYTES,
} from "@/email/lib/attachments/limits";
import {
  collectTransferFiles,
  optimizeImageToWebp,
} from "@/email/lib/attachments/image-optimize";

export type IngestAttachmentResult =
  | { ok: true; attachments: DraftAttachment[] }
  | { ok: false; error: string };

function slugFilename(name: string): string {
  const trimmed = name.trim() || "attachment";
  return trimmed.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
}

async function fileToDraftAttachment(
  file: File,
  productId: string,
  draftId: string,
): Promise<DraftAttachment> {
  const isImage = (file.type || "").startsWith("image/");
  const optimized = isImage ? await optimizeImageToWebp(file) : null;
  const blob = optimized?.blob ?? file;
  const contentType =
    optimized?.mimeType ?? (file.type || "application/octet-stream");
  const filename = slugFilename(optimized?.filename ?? file.name);
  const id = crypto.randomUUID().slice(0, 8);
  const bytes = await blob.arrayBuffer();
  await saveDraftAttachmentBytes(productId, draftId, id, bytes);
  return {
    id,
    filename,
    contentType,
    size: bytes.byteLength,
    origin: "local",
  };
}

export async function ingestFilesAsAttachments(
  files: File[],
  existing: DraftAttachment[],
  productId: string,
  draftId: string,
  bodyByteLength: number,
): Promise<IngestAttachmentResult> {
  if (!files.length) {
    return { ok: true, attachments: existing };
  }
  if (existing.length + files.length > MAX_ATTACHMENT_COUNT) {
    return {
      ok: false,
      error: `Maximum ${MAX_ATTACHMENT_COUNT} attachments per message.`,
    };
  }

  const added: DraftAttachment[] = [];
  for (const file of files) {
    try {
      const attachment = await fileToDraftAttachment(file, productId, draftId);
      added.push(attachment);
    } catch {
      return { ok: false, error: `Failed to add ${file.name || "file"}.` };
    }
  }

  const next = [...existing, ...added];
  const total = totalAttachmentBytes(next) + bodyByteLength;
  if (total > MAX_STAGED_ATTACHMENTS_BYTES) {
    for (const item of added) {
      const { deleteDraftAttachmentBytes } = await import(
        "@/email/lib/attachments/draft-attachment-store"
      );
      await deleteDraftAttachmentBytes(productId, draftId, item.id);
    }
    return {
      ok: false,
      error: "Attachments exceed the send size limit. Remove files or shorten the message.",
    };
  }

  return { ok: true, attachments: next };
}

export async function ingestTransferAsAttachments(
  data: DataTransfer | null,
  existing: DraftAttachment[],
  productId: string,
  draftId: string,
  bodyByteLength: number,
): Promise<IngestAttachmentResult> {
  const files = collectTransferFiles(data);
  return ingestFilesAsAttachments(
    files,
    existing,
    productId,
    draftId,
    bodyByteLength,
  );
}

export function renameDraftAttachment(
  attachments: DraftAttachment[],
  id: string,
  filename: string,
): DraftAttachment[] {
  const trimmed = slugFilename(filename);
  if (!trimmed) return attachments;
  return attachments.map((item) =>
    item.id === id ? { ...item, filename: trimmed } : item,
  );
}

export function removeDraftAttachment(
  attachments: DraftAttachment[],
  id: string,
): DraftAttachment[] {
  return attachments.filter((item) => item.id !== id);
}
