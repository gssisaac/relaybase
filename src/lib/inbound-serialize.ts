import type { InboundEmailMeta } from "./inbound-store";
import { decodeMimeHeader } from "./mime-parse";

export function decodeSubject(subject: string): string {
  return decodeMimeHeader(subject) || subject || "(no subject)";
}

export function serializeInboundListItem(message: InboundEmailMeta) {
  return {
    key: message.id,
    fromEmail: message.fromEmail,
    toEmail: message.toEmail,
    subject: decodeSubject(message.subject),
    status: "stored",
    action: "worker",
    receivedAt: message.receivedAt,
    bodyPreview: message.bodyPreview,
    attachmentCount: message.attachments.length,
    messageId: message.messageId,
    size: message.size,
  };
}

export function serializeInboundMessage(message: InboundEmailMeta) {
  return {
    key: message.id,
    fromEmail: message.fromEmail,
    toEmail: message.toEmail,
    subject: decodeSubject(message.subject),
    status: "stored",
    action: "worker",
    receivedAt: message.receivedAt,
    bodyPreview: message.bodyPreview,
    bodyText: message.bodyText,
    bodyHtml: message.bodyHtml,
    messageId: message.messageId,
    size: message.size,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      filename: decodeMimeHeader(attachment.filename) || attachment.filename,
    })),
  };
}
