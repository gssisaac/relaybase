import type { DraftAttachment } from "@/email/components/mailbox/types";
import {
  deleteDraftAttachmentBytes,
  loadDraftAttachmentBytes,
} from "@/email/lib/attachments/draft-attachment-store";
import { blobToBase64 } from "@/email/lib/attachments/image-optimize";

export type SendAttachmentPayload = {
  filename: string;
  contentType: string;
  contentBase64?: string;
  source?: {
    kind: "inbound" | "sent";
    domain: string;
    messageId: string;
    attachmentId: string;
  };
};

export async function buildSendAttachmentPayloads(
  attachments: DraftAttachment[],
  productId: string,
  draftId: string,
): Promise<SendAttachmentPayload[]> {
  const out: SendAttachmentPayload[] = [];
  for (const item of attachments) {
    if (item.origin === "source" && item.source) {
      out.push({
        filename: item.filename,
        contentType: item.contentType,
        source: item.source,
      });
      continue;
    }
    const bytes = await loadDraftAttachmentBytes(productId, draftId, item.id);
    if (!bytes) {
      throw new Error(`Missing attachment file: ${item.filename}`);
    }
    const contentBase64 = await blobToBase64(new Blob([bytes]));
    out.push({
      filename: item.filename,
      contentType: item.contentType,
      contentBase64,
    });
  }
  return out;
}

export async function cleanupLocalAttachmentBytes(
  attachments: DraftAttachment[],
  productId: string,
  draftId: string,
): Promise<void> {
  await Promise.all(
    attachments
      .filter((item) => item.origin === "local")
      .map((item) =>
        deleteDraftAttachmentBytes(productId, draftId, item.id),
      ),
  );
}

export function sourceAttachmentPreviewPath(
  apiBase: string,
  attachment: DraftAttachment,
): string | null {
  const source = attachment.source;
  if (!source) return null;
  const params = new URLSearchParams({ domain: source.domain });
  const base =
    source.kind === "inbound"
      ? `${apiBase}/inbox/${encodeURIComponent(source.messageId)}/attachments/${encodeURIComponent(source.attachmentId)}`
      : `${apiBase}/sent/${encodeURIComponent(source.messageId)}/attachments/${encodeURIComponent(source.attachmentId)}`;
  return `${base}?${params.toString()}`;
}
