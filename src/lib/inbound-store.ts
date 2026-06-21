import { decodeMimeHeader, parseInboundMime } from "./mime-parse";
import { buildStrippedInboundMime } from "./mime";

export type InboundAttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string;
  contentId: string | null;
};

export type InboundEmailMeta = {
  id: string;
  domain: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  receivedAt: string;
  messageId: string | null;
  size: number;
  bodyPreview: string;
  bodyText: string;
  bodyHtml: string | null;
  attachments: InboundAttachmentMeta[];
};

const MAX_MESSAGES = 500;
const PREFIX = "inbound";

function domainFromAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).trim().toLowerCase() : "";
}

function objectPrefix(domain: string, id: string): string {
  return `${PREFIX}/${domain}/${id}`;
}

function metaObjectKey(domain: string, id: string): string {
  return `${objectPrefix(domain, id)}/meta.json`;
}

function rawObjectKey(domain: string, id: string): string {
  return `${objectPrefix(domain, id)}/raw.eml`;
}

function attachmentObjectKey(
  domain: string,
  id: string,
  attachmentId: string,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${objectPrefix(domain, id)}/attachments/${attachmentId}-${safeName}`;
}

function listPrefix(domain: string): string {
  return `${PREFIX}/${domain.trim().toLowerCase()}/`;
}

export function previewText(text: string, max = 500): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

async function deleteMessageObjects(
  bucket: R2Bucket,
  domain: string,
  id: string,
): Promise<void> {
  const prefix = `${objectPrefix(domain, id)}/`;
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor });
    for (const object of listed.objects) {
      await bucket.delete(object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

async function pruneOldMessages(bucket: R2Bucket, domain: string): Promise<void> {
  const listed = await bucket.list({ prefix: listPrefix(domain), limit: MAX_MESSAGES + 50 });
  const metas: Array<{ id: string; receivedAt: string }> = [];

  for (const object of listed.objects) {
    if (!object.key.endsWith("/meta.json")) continue;
    const id = object.key.slice(listPrefix(domain).length).replace(/\/meta\.json$/, "");
    const metaObject = await bucket.get(object.key);
    if (!metaObject) continue;
    const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
    metas.push({ id, receivedAt: meta.receivedAt });
  }

  metas.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  for (const stale of metas.slice(MAX_MESSAGES)) {
    await deleteMessageObjects(bucket, domain, stale.id);
  }
}

export async function storeInboundEmail(
  bucket: R2Bucket,
  params: {
    fromEmail: string;
    toEmail: string;
    subject: string;
    messageId: string | null;
    size: number;
    raw: ArrayBuffer;
  },
): Promise<InboundEmailMeta> {
  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const domain = domainFromAddress(params.toEmail);
  if (!domain) {
    throw new Error("Inbound email is missing a recipient domain");
  }

  const parsed = await parseInboundMime(params.raw);
  const attachmentMeta: InboundAttachmentMeta[] = [];

  for (const attachment of parsed.attachments) {
    await bucket.put(
      attachmentObjectKey(domain, id, attachment.id, attachment.filename),
      attachment.content,
      {
        httpMetadata: { contentType: attachment.contentType },
        customMetadata: {
          filename: attachment.filename,
          disposition: attachment.disposition,
        },
      },
    );
    attachmentMeta.push({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      disposition: attachment.disposition,
      contentId: attachment.contentId,
    });
  }

  const subject =
    parsed.subject ||
    decodeMimeHeader(params.subject) ||
    "(no subject)";

  const record: InboundEmailMeta = {
    id,
    domain,
    fromEmail: params.fromEmail,
    toEmail: params.toEmail,
    subject,
    receivedAt,
    messageId: params.messageId,
    size: params.size,
    bodyPreview: previewText(parsed.bodyText || params.subject),
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    attachments: attachmentMeta,
  };

  await bucket.put(metaObjectKey(domain, id), JSON.stringify(record), {
    httpMetadata: { contentType: "application/json" },
  });

  const rawBody =
    attachmentMeta.length > 0
      ? buildStrippedInboundMime({
          fromEmail: params.fromEmail,
          toEmail: params.toEmail,
          subject,
          messageId: params.messageId,
          bodyText: parsed.bodyText,
          bodyHtml: parsed.bodyHtml,
          attachments: attachmentMeta,
        })
      : params.raw;

  await bucket.put(rawObjectKey(domain, id), rawBody, {
    httpMetadata: { contentType: "message/rfc822" },
    customMetadata: {
      from: params.fromEmail,
      to: params.toEmail,
      domain,
    },
  });

  await pruneOldMessages(bucket, domain);
  return record;
}

export async function listInboundEmails(
  bucket: R2Bucket,
  filters: { domain?: string; limit?: number } = {},
): Promise<InboundEmailMeta[]> {
  const domain = filters.domain?.trim().toLowerCase();
  if (!domain) return [];

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), MAX_MESSAGES);
  const listed = await bucket.list({ prefix: listPrefix(domain), limit: MAX_MESSAGES + 50 });
  const messages: InboundEmailMeta[] = [];

  for (const object of listed.objects) {
    if (!object.key.endsWith("/meta.json")) continue;
    const metaObject = await bucket.get(object.key);
    if (!metaObject) continue;
    const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
    messages.push({ ...meta, attachments: meta.attachments ?? [] });
  }

  messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return messages.slice(0, limit);
}

export async function getInboundEmail(
  bucket: R2Bucket,
  id: string,
  domainHint?: string,
): Promise<InboundEmailMeta | null> {
  if (domainHint) {
    return getInboundEmailForDomain(bucket, domainHint.trim().toLowerCase(), id);
  }

  const listed = await bucket.list({ prefix: `${PREFIX}/`, limit: 1000 });
  for (const object of listed.objects) {
    if (!object.key.endsWith(`/${id}/meta.json`)) continue;
    const domain = object.key.split("/")[1];
    if (!domain) continue;
    return getInboundEmailForDomain(bucket, domain, id);
  }

  return null;
}

async function getInboundEmailForDomain(
  bucket: R2Bucket,
  domain: string,
  id: string,
): Promise<InboundEmailMeta | null> {
  const metaObject = await bucket.get(metaObjectKey(domain, id));
  if (!metaObject) return null;

  const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
  return { ...meta, attachments: meta.attachments ?? [] };
}

export async function getInboundAttachment(
  bucket: R2Bucket,
  params: { domain: string; messageId: string; attachmentId: string },
): Promise<{ meta: InboundAttachmentMeta; body: ArrayBuffer } | null> {
  const domain = params.domain.trim().toLowerCase();
  const message = await getInboundEmailForDomain(bucket, domain, params.messageId);
  if (!message) return null;

  const attachment = message.attachments.find((item) => item.id === params.attachmentId);
  if (!attachment) return null;

  const prefix = `${objectPrefix(domain, params.messageId)}/attachments/${attachment.id}-`;
  const listed = await bucket.list({ prefix, limit: 20 });
  const objectKey = listed.objects[0]?.key;
  if (!objectKey) return null;

  const object = await bucket.get(objectKey);
  if (!object) return null;

  return {
    meta: attachment,
    body: await object.arrayBuffer(),
  };
}
