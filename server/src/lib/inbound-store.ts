import {
  buildBouncePreview,
  isBounceMessage,
  parseBounceDiagnostic,
} from "./bounce-detect";
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
  /** All To recipients from the MIME headers (may include more than `toEmail`). */
  toEmails?: string[];
  /** Cc recipients from the MIME headers. */
  ccEmails?: string[];
  subject: string;
  receivedAt: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  size: number;
  bodyPreview: string;
  bodyText: string;
  bodyHtml: string | null;
  attachments: InboundAttachmentMeta[];
  /** ISO timestamp when marked read, or null when unread. Missing on legacy rows. */
  readAt?: string | null;
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

/** Normalize RFC Message-ID for comparison (`<id@host>` → `id@host`). */
export function normalizeInboundMessageId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const unwrapped =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unwrapped || null;
}

function messageIdIndexKey(domain: string, normalizedMessageId: string): string {
  return `${PREFIX}/${domain}/by-message-id/${encodeURIComponent(normalizedMessageId)}`;
}

async function writeMessageIdIndex(
  bucket: R2Bucket,
  domain: string,
  normalizedMessageId: string,
  id: string,
): Promise<void> {
  await bucket.put(messageIdIndexKey(domain, normalizedMessageId), id, {
    httpMetadata: { contentType: "text/plain" },
  });
}

async function findExistingByMessageId(
  bucket: R2Bucket,
  domain: string,
  normalizedMessageId: string,
): Promise<InboundEmailMeta | null> {
  const index = await bucket.get(messageIdIndexKey(domain, normalizedMessageId));
  if (index) {
    const id = (await index.text()).trim();
    if (id) {
      const existing = await getInboundEmailForDomain(bucket, domain, id);
      if (existing) return existing;
    }
  }

  // Pre-index messages (or a lost index object): scan once and backfill.
  const listed = await bucket.list({
    prefix: listPrefix(domain),
    limit: MAX_MESSAGES + 50,
  });
  for (const object of listed.objects) {
    if (!object.key.endsWith("/meta.json")) continue;
    const metaObject = await bucket.get(object.key);
    if (!metaObject) continue;
    const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
    if (normalizeInboundMessageId(meta.messageId) !== normalizedMessageId) {
      continue;
    }
    await writeMessageIdIndex(bucket, domain, normalizedMessageId, meta.id);
    return normalizeReadState(normalizeRecipientLists(meta));
  }
  return null;
}

export type StoreInboundEmailResult = {
  record: InboundEmailMeta;
  /** False when this envelope delivery matched an existing Message-ID. */
  created: boolean;
};

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
    inReplyTo?: string | null;
    references?: string | null;
    size: number;
    raw: ArrayBuffer;
  },
): Promise<StoreInboundEmailResult> {
  const receivedAt = new Date().toISOString();
  const domain = domainFromAddress(params.toEmail);
  if (!domain) {
    throw new Error("Inbound email is missing a recipient domain");
  }

  const normalizedMessageId = normalizeInboundMessageId(params.messageId);
  if (normalizedMessageId) {
    const existing = await findExistingByMessageId(
      bucket,
      domain,
      normalizedMessageId,
    );
    if (existing) {
      // Cloudflare Email Routing invokes the Worker once per matching local
      // address (To + Cc). Keep a single R2 record per RFC Message-ID.
      return { record: existing, created: false };
    }
  }

  const id = crypto.randomUUID();
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

  const isBounce = isBounceMessage(params.raw, params.fromEmail);
  const bounceDiagnostic = isBounce ? parseBounceDiagnostic(params.raw) : null;
  const bouncePreview = bounceDiagnostic
    ? buildBouncePreview(bounceDiagnostic)
    : null;

  const bodyText =
    parsed.bodyText || (isBounce ? bouncePreview ?? "(empty message)" : "");
  const bodyPreview = previewText(
    bodyText || params.subject || (isBounce ? "Bounce notification" : ""),
  );

  const toEmails = parsed.toEmails.length
    ? parsed.toEmails
    : [params.toEmail];
  const record: InboundEmailMeta = {
    id,
    domain,
    fromEmail: params.fromEmail,
    toEmail: params.toEmail,
    toEmails,
    ccEmails: parsed.ccEmails,
    subject,
    receivedAt,
    messageId: params.messageId,
    inReplyTo: params.inReplyTo ?? null,
    references: params.references ?? null,
    size: params.size,
    bodyPreview,
    bodyText,
    bodyHtml: parsed.bodyHtml,
    attachments: attachmentMeta,
    // New mail always starts unread; legacy rows (no key at all) are
    // normalized to "already read" by `normalizeReadState`.
    readAt: null,
  };

  await bucket.put(metaObjectKey(domain, id), JSON.stringify(record), {
    httpMetadata: { contentType: "application/json" },
  });

  const rawBody =
    attachmentMeta.length > 0
      ? buildStrippedInboundMime({
          fromEmail: params.fromEmail,
          toEmail: params.toEmail,
          ccEmails: parsed.ccEmails,
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

  if (normalizedMessageId) {
    await writeMessageIdIndex(bucket, domain, normalizedMessageId, id);
  }

  await pruneOldMessages(bucket, domain);
  return { record, created: true };
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
    messages.push(
      normalizeReadState({ ...meta, attachments: meta.attachments ?? [] }),
    );
  }

  messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  // Collapse historical To+Cc duplicates that predate Message-ID indexing.
  const deduped: InboundEmailMeta[] = [];
  const seenMessageIds = new Set<string>();
  for (const message of messages) {
    const rfc = normalizeInboundMessageId(message.messageId);
    if (rfc) {
      if (seenMessageIds.has(rfc)) continue;
      seenMessageIds.add(rfc);
    }
    deduped.push(message);
  }
  return deduped.slice(0, limit);
}

export async function getInboundEmail(
  bucket: R2Bucket,
  id: string,
  domainHint?: string,
): Promise<InboundEmailMeta | null> {
  if (domainHint) {
    const hit = await getInboundEmailForDomain(
      bucket,
      domainHint.trim().toLowerCase(),
      id,
    );
    if (hit) return hit;
  }

  const listed = await bucket.list({ prefix: `${PREFIX}/`, limit: 1000 });
  for (const object of listed.objects) {
    if (!object.key.endsWith(`/${id}/meta.json`)) continue;
    const domain = object.key.split("/")[1];
    if (!domain) continue;
    if (domainHint && domain === domainHint.trim().toLowerCase()) continue;
    return getInboundEmailForDomain(bucket, domain, id);
  }

  return null;
}

function normalizeRecipientLists(meta: InboundEmailMeta): InboundEmailMeta {
  const toEmails =
    meta.toEmails && meta.toEmails.length > 0
      ? meta.toEmails
      : meta.toEmail
        ? [meta.toEmail]
        : [];
  const ccEmails = meta.ccEmails ?? [];
  return {
    ...meta,
    attachments: meta.attachments ?? [],
    toEmails,
    ccEmails,
  };
}

/**
 * Legacy rows written before read/unread tracking existed have no `readAt`
 * key at all — treat those as already-read backlog (matches the previous
 * client-side "baseline on first load" behavior). Rows written by the
 * current `storeInboundEmail` always have an explicit `readAt` (`null` for
 * unread), so this fallback only ever fires for pre-migration data.
 */
function normalizeReadState(meta: InboundEmailMeta): InboundEmailMeta {
  if ("readAt" in meta) return meta;
  return { ...meta, readAt: meta.receivedAt };
}

async function getInboundEmailForDomain(
  bucket: R2Bucket,
  domain: string,
  id: string,
): Promise<InboundEmailMeta | null> {
  const metaObject = await bucket.get(metaObjectKey(domain, id));
  if (!metaObject) return null;

  const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
  const normalized = normalizeReadState(normalizeRecipientLists(meta));
  if (meta.toEmails?.length || meta.ccEmails?.length) {
    return normalized;
  }

  // Backfill To/Cc from archived raw MIME for older messages.
  const rawObject = await bucket.get(rawObjectKey(domain, id));
  if (!rawObject) return normalized;
  try {
    const parsed = await parseInboundMime(await rawObject.arrayBuffer());
    return {
      ...normalized,
      toEmails: parsed.toEmails.length ? parsed.toEmails : normalized.toEmails,
      ccEmails: parsed.ccEmails,
    };
  } catch {
    return normalized;
  }
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

/**
 * Bulk mark-read/unread. `readAt: null` marks unread, an ISO timestamp marks
 * read. Ids that don't resolve to a message in this domain are skipped.
 */
export async function setInboundReadState(
  bucket: R2Bucket,
  domain: string,
  ids: string[],
  readAt: string | null,
): Promise<{ updated: string[] }> {
  const normalizedDomain = domain.trim().toLowerCase();
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const updated: string[] = [];

  await Promise.all(
    uniqueIds.map(async (id) => {
      const key = metaObjectKey(normalizedDomain, id);
      const metaObject = await bucket.get(key);
      if (!metaObject) return;

      const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
      const next: InboundEmailMeta = { ...meta, readAt };
      await bucket.put(key, JSON.stringify(next), {
        httpMetadata: { contentType: "application/json" },
      });
      updated.push(id);
    }),
  );

  return { updated };
}

/**
 * Look up a single message within a specific domain only (no global scan).
 * Used by mobile routes so a request scoped to mobile-enabled domains can
 * never return a message from a disabled domain.
 */
export async function getInboundEmailInDomain(
  bucket: R2Bucket,
  domain: string,
  id: string,
): Promise<InboundEmailMeta | null> {
  return getInboundEmailForDomain(bucket, domain.trim().toLowerCase(), id);
}
