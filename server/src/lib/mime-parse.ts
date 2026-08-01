import PostalMime, { decodeWords } from "postal-mime";

export function decodeMimeHeader(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return decodeWords(value).trim();
}

export type ParsedAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string;
  contentId: string | null;
  content: ArrayBuffer;
};

export type ParsedInboundEmail = {
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  attachments: ParsedAttachment[];
};

function attachmentBytes(content: Uint8Array | ArrayBuffer | string): ArrayBuffer {
  if (typeof content === "string") {
    return new TextEncoder().encode(content).buffer as ArrayBuffer;
  }
  const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function normalizeContentId(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  return value.replace(/^<|>$/g, "").trim() || null;
}

export async function parseInboundMime(raw: ArrayBuffer): Promise<ParsedInboundEmail> {
  const parser = new PostalMime();
  const email = await parser.parse(raw);

  const attachments: ParsedAttachment[] = (email.attachments ?? []).map(
    (attachment, index) => {
      const content = attachmentBytes(attachment.content);
      return {
        id: String(index),
        filename:
          decodeMimeHeader(attachment.filename) || `attachment-${index + 1}`,
        contentType: attachment.mimeType?.trim() || "application/octet-stream",
        size: content.byteLength,
        disposition: attachment.disposition?.trim() || "attachment",
        contentId: normalizeContentId(attachment.contentId),
        content,
      };
    },
  );

  const subject =
    decodeMimeHeader(email.subject) ||
    decodeMimeHeader(email.headers.find((header) => header.key === "subject")?.value);

  return {
    subject,
    bodyText: email.text?.trim() ?? "",
    bodyHtml: email.html?.trim() || null,
    attachments,
  };
}
