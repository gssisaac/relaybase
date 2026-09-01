/** Cloudflare Email Sending total message cap (including attachments). */
export const MAX_SEND_MESSAGE_BYTES = 5 * 1024 * 1024;

/** Client-side cap — leave headroom for MIME headers and base64 overhead. */
export const MAX_STAGED_ATTACHMENTS_BYTES = Math.floor(4.5 * 1024 * 1024);

export const MAX_ATTACHMENT_COUNT = 20;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function totalAttachmentBytes(
  attachments: Array<{ size: number }>,
): number {
  return attachments.reduce((sum, item) => sum + (item.size || 0), 0);
}

export function stagedSizeError(
  attachments: Array<{ size: number }>,
  bodyBytes: number,
): string | null {
  const total = totalAttachmentBytes(attachments) + bodyBytes;
  if (total <= MAX_STAGED_ATTACHMENTS_BYTES) return null;
  return `Attachments and body exceed ${formatBytes(MAX_STAGED_ATTACHMENTS_BYTES)} (${formatBytes(total)} staged). Remove files or shorten the message.`;
}
