import {
  buildBouncePreview,
  isBounceMessage,
  parseBounceDiagnostic,
} from "./bounce-detect";
import { decodeMimeHeader, parseInboundMime } from "./mime-parse";
import { buildStrippedInboundMime } from "./mime";
import {
  deleteSearchRows,
  updateSearchReadState,
  upsertSearchRows,
} from "./inbound-search";

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
  /** Display name from the MIME `From:` header. Empty/absent on legacy rows. */
  fromName?: string;
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

export const MAX_MESSAGES = 5000;
const PREFIX = "inbound";
const LIST_INDEX_VERSION = 1 as const;

/** Compact list row stored in `inbound/{domain}/_list.json` (no bodyText/bodyHtml). */
export type InboundListEntry = Omit<InboundEmailMeta, "bodyText" | "bodyHtml">;

type ListIndexFile = {
  version: typeof LIST_INDEX_VERSION;
  messages: InboundListEntry[];
};

export type ListInboundEmailsPage = {
  messages: InboundEmailMeta[];
  nextBefore: string | null;
  hasMore: boolean;
  /** Total retained messages for the domain (whole index, not this page). */
  total: number;
  /** Unread messages for the domain (whole index, not this page). */
  unread: number;
};

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

function listIndexKey(domain: string): string {
  return `${listPrefix(domain)}_list.json`;
}

function toListEntry(meta: InboundEmailMeta): InboundListEntry {
  return {
    id: meta.id,
    domain: meta.domain,
    fromEmail: meta.fromEmail,
    fromName: meta.fromName,
    toEmail: meta.toEmail,
    toEmails: meta.toEmails,
    ccEmails: meta.ccEmails,
    subject: meta.subject,
    receivedAt: meta.receivedAt,
    messageId: meta.messageId,
    inReplyTo: meta.inReplyTo,
    references: meta.references,
    size: meta.size,
    bodyPreview: meta.bodyPreview,
    attachments: meta.attachments ?? [],
    readAt: meta.readAt,
  };
}

function fromListEntry(entry: InboundListEntry): InboundEmailMeta {
  return {
    ...entry,
    attachments: entry.attachments ?? [],
    bodyText: "",
    bodyHtml: null,
  };
}

function sortListEntries(messages: InboundListEntry[]): InboundListEntry[] {
  return [...messages].sort((a, b) => {
    const byDate = b.receivedAt.localeCompare(a.receivedAt);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });
}

function dedupeListEntries(messages: InboundListEntry[]): InboundListEntry[] {
  const deduped: InboundListEntry[] = [];
  const seenIds = new Set<string>();
  const seenMessageIds = new Set<string>();
  for (const message of messages) {
    if (seenIds.has(message.id)) continue;
    seenIds.add(message.id);
    const rfc = normalizeInboundMessageId(message.messageId);
    if (rfc) {
      if (seenMessageIds.has(rfc)) continue;
      seenMessageIds.add(rfc);
    }
    deduped.push(message);
  }
  return deduped;
}

function parseListCursor(
  before: string | undefined,
): { receivedAt: string; id: string | null } | null {
  const raw = before?.trim();
  if (!raw) return null;
  const sep = raw.lastIndexOf("|");
  if (sep <= 0) return { receivedAt: raw, id: null };
  return { receivedAt: raw.slice(0, sep), id: raw.slice(sep + 1) || null };
}

function encodeListCursor(entry: InboundListEntry): string {
  return `${entry.receivedAt}|${entry.id}`;
}

function isBeforeCursor(
  entry: InboundListEntry,
  cursor: { receivedAt: string; id: string | null },
): boolean {
  const byDate = entry.receivedAt.localeCompare(cursor.receivedAt);
  if (byDate < 0) return true;
  if (byDate > 0) return false;
  if (!cursor.id) return false;
  return entry.id.localeCompare(cursor.id) < 0;
}

async function loadListIndex(
  bucket: R2Bucket,
  domain: string,
): Promise<InboundListEntry[] | null> {
  const object = await bucket.get(listIndexKey(domain));
  if (!object) return null;
  try {
    const parsed = JSON.parse(await object.text()) as ListIndexFile;
    if (parsed.version !== LIST_INDEX_VERSION || !Array.isArray(parsed.messages)) {
      return null;
    }
    return parsed.messages;
  } catch {
    return null;
  }
}

async function saveListIndex(
  bucket: R2Bucket,
  domain: string,
  messages: InboundListEntry[],
): Promise<void> {
  const file: ListIndexFile = {
    version: LIST_INDEX_VERSION,
    messages: sortListEntries(dedupeListEntries(messages)).slice(0, MAX_MESSAGES),
  };
  await bucket.put(listIndexKey(domain), JSON.stringify(file), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function scanMetaEntries(
  bucket: R2Bucket,
  domain: string,
): Promise<InboundListEntry[]> {
  const messages: InboundListEntry[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({
      prefix: listPrefix(domain),
      limit: 1000,
      cursor,
    });
    for (const object of listed.objects) {
      if (!object.key.endsWith("/meta.json")) continue;
      const metaObject = await bucket.get(object.key);
      if (!metaObject) continue;
      const meta = JSON.parse(await metaObject.text()) as InboundEmailMeta;
      messages.push(
        toListEntry(
          normalizeReadState(
            normalizeRecipientLists({
              ...meta,
              attachments: meta.attachments ?? [],
            }),
          ),
        ),
      );
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return sortListEntries(dedupeListEntries(messages)).slice(0, MAX_MESSAGES);
}

async function ensureListIndex(
  bucket: R2Bucket,
  domain: string,
): Promise<InboundListEntry[]> {
  const existing = await loadListIndex(bucket, domain);
  if (existing) return sortListEntries(dedupeListEntries(existing));
  const rebuilt = await scanMetaEntries(bucket, domain);
  await saveListIndex(bucket, domain, rebuilt);
  return rebuilt;
}

async function upsertListEntry(
  bucket: R2Bucket,
  domain: string,
  meta: InboundEmailMeta,
): Promise<void> {
  const index = await ensureListIndex(bucket, domain);
  const next = [
    toListEntry(meta),
    ...index.filter((entry) => entry.id !== meta.id),
  ];
  await saveListIndex(bucket, domain, next);
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

  const listIndex = await loadListIndex(bucket, domain);
  if (listIndex) {
    const hit = listIndex.find(
      (entry) =>
        normalizeInboundMessageId(entry.messageId) === normalizedMessageId,
    );
    if (hit) {
      const existing = await getInboundEmailForDomain(bucket, domain, hit.id);
      if (existing) {
        await writeMessageIdIndex(bucket, domain, normalizedMessageId, hit.id);
        return existing;
      }
    }
  }

  // Pre-index messages (or a lost index object): scan once and backfill.
  const scanned = await scanMetaEntries(bucket, domain);
  const hit = scanned.find(
    (entry) =>
      normalizeInboundMessageId(entry.messageId) === normalizedMessageId,
  );
  if (!hit) return null;
  await writeMessageIdIndex(bucket, domain, normalizedMessageId, hit.id);
  return getInboundEmailForDomain(bucket, domain, hit.id);
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

async function pruneOldMessages(
  bucket: R2Bucket,
  domain: string,
  searchIndex?: D1Database,
): Promise<void> {
  const index = await ensureListIndex(bucket, domain);
  const sorted = sortListEntries(index);
  const stale = sorted.slice(MAX_MESSAGES);
  if (stale.length === 0) return;

  for (const entry of stale) {
    await deleteMessageObjects(bucket, domain, entry.id);
  }
  await saveListIndex(bucket, domain, sorted.slice(0, MAX_MESSAGES));

  if (searchIndex) {
    try {
      await deleteSearchRows(searchIndex, stale.map((entry) => entry.id));
    } catch (error) {
      console.error("Failed to prune inbound search rows", error);
    }
  }
}

export async function storeInboundEmail(
  bucket: R2Bucket,
  params: {
    /** Envelope sender (MAIL FROM / Return-Path) — used for bounce detection. */
    envelopeFrom: string;
    toEmail: string;
    subject: string;
    messageId: string | null;
    inReplyTo?: string | null;
    references?: string | null;
    size: number;
    raw: ArrayBuffer;
  },
  /** Optional D1 FTS index — writes are best-effort (R2 is authoritative). */
  searchIndex?: D1Database,
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

  const isBounce = isBounceMessage(params.raw, params.envelopeFrom);
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
  // Prefer the MIME `From:` header (human-readable address) over the envelope
  // sender, which for mailing-list/bounce mail is a VERP path like
  // `bounce+abc=user@example.com`. Fall back to the envelope only when the
  // MIME From is missing (e.g. some delivery-status notifications).
  const fromEmail = parsed.fromEmail || params.envelopeFrom;
  const fromName = parsed.fromName;
  const record: InboundEmailMeta = {
    id,
    domain,
    fromEmail,
    fromName,
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
          fromEmail,
          fromName,
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
      from: params.envelopeFrom,
      to: params.toEmail,
      domain,
    },
  });

  if (normalizedMessageId) {
    await writeMessageIdIndex(bucket, domain, normalizedMessageId, id);
  }

  await upsertListEntry(bucket, domain, record);

  if (searchIndex) {
    try {
      await upsertSearchRows(searchIndex, [record]);
    } catch (error) {
      console.error("Failed to index inbound email for search", error);
    }
  }

  await pruneOldMessages(bucket, domain, searchIndex);
  return { record, created: true };
}

/**
 * Legacy rows written before the MIME-From fix have no `fromName` key and
 * carry the envelope (VERP) sender as `fromEmail`. Re-parse the archived raw
 * MIME to recover the human-readable `From:` header and write the corrected
 * meta back to R2 so subsequent list/detail reads skip the backfill. No-op for
 * rows already carrying `fromName` (including `""` — a genuinely nameless From).
 */
async function backfillLegacyFrom(
  bucket: R2Bucket,
  domain: string,
  meta: InboundEmailMeta,
): Promise<InboundEmailMeta> {
  if (meta.fromName !== undefined) return meta;
  const rawObject = await bucket.get(rawObjectKey(domain, meta.id));
  if (!rawObject) return meta;
  try {
    const parsed = await parseInboundMime(await rawObject.arrayBuffer());
    const backfilled: InboundEmailMeta = {
      ...meta,
      fromEmail: parsed.fromEmail || meta.fromEmail,
      fromName: parsed.fromName,
      toEmails: parsed.toEmails.length
        ? parsed.toEmails
        : meta.toEmails?.length
          ? meta.toEmails
          : [meta.toEmail],
      ccEmails: parsed.ccEmails.length ? parsed.ccEmails : meta.ccEmails ?? [],
    };
    void bucket.put(metaObjectKey(domain, meta.id), JSON.stringify(backfilled), {
      httpMetadata: { contentType: "application/json" },
    });
    return backfilled;
  } catch {
    return meta;
  }
}

/**
 * Unread test with the same legacy fallback as `normalizeReadState`: rows
 * written before read tracking existed have no `readAt` key at all and are
 * treated as already read.
 */
function isUnreadEntry(entry: InboundListEntry): boolean {
  if (!("readAt" in entry)) return false;
  return !entry.readAt;
}

/**
 * Whole-domain compact index (read-state normalized), for cheap count
 * aggregation without loading any per-message `meta.json`.
 */
export async function listInboundIndexEntries(
  bucket: R2Bucket,
  domain: string,
): Promise<InboundListEntry[]> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return [];
  const index = await ensureListIndex(bucket, normalized);
  return index.map((entry) =>
    "readAt" in entry ? entry : { ...entry, readAt: entry.receivedAt },
  );
}

export async function listInboundEmailsPage(
  bucket: R2Bucket,
  filters: { domain?: string; limit?: number; before?: string } = {},
): Promise<ListInboundEmailsPage> {
  const domain = filters.domain?.trim().toLowerCase();
  if (!domain) {
    return { messages: [], nextBefore: null, hasMore: false, total: 0, unread: 0 };
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), MAX_MESSAGES);
  const index = await ensureListIndex(bucket, domain);
  const cursor = parseListCursor(filters.before);
  const filtered = cursor
    ? index.filter((entry) => isBeforeCursor(entry, cursor))
    : index;
  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const last = page[page.length - 1];

  let unread = 0;
  for (const entry of index) {
    if (isUnreadEntry(entry)) unread += 1;
  }

  const messages: InboundEmailMeta[] = [];
  for (const entry of page) {
    const normalized = normalizeReadState(normalizeRecipientLists(fromListEntry(entry)));
    messages.push(
      entry.fromName === undefined
        ? await backfillLegacyFrom(bucket, domain, normalized)
        : normalized,
    );
  }

  return {
    messages,
    nextBefore: hasMore && last ? encodeListCursor(last) : null,
    hasMore,
    total: index.length,
    unread,
  };
}

export async function listInboundEmails(
  bucket: R2Bucket,
  filters: { domain?: string; limit?: number; before?: string } = {},
): Promise<InboundEmailMeta[]> {
  const page = await listInboundEmailsPage(bucket, filters);
  return page.messages;
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
  // Backfill from raw MIME for older messages: legacy rows have no `fromName`
  // key and may have empty To/Cc lists. New rows always carry `fromName`
  // (possibly empty string) and populated recipient lists, so this only runs
  // for pre-migration data.
  const needsBackfill =
    normalized.fromName === undefined ||
    !(normalized.toEmails?.length || normalized.ccEmails?.length);
  if (!needsBackfill) {
    return normalized;
  }

  const rawObject = await bucket.get(rawObjectKey(domain, id));
  if (!rawObject) return normalized;
  try {
    const parsed = await parseInboundMime(await rawObject.arrayBuffer());
    const backfilled: InboundEmailMeta = {
      ...normalized,
      fromEmail: parsed.fromEmail || normalized.fromEmail,
      fromName:
        normalized.fromName === undefined
          ? parsed.fromName
          : normalized.fromName,
      toEmails: parsed.toEmails.length ? parsed.toEmails : normalized.toEmails,
      ccEmails: parsed.ccEmails.length ? parsed.ccEmails : normalized.ccEmails,
    };
    // Persist the correction so future reads skip the raw MIME parse.
    void bucket.put(metaObjectKey(domain, id), JSON.stringify(backfilled), {
      httpMetadata: { contentType: "application/json" },
    });
    return backfilled;
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
  /** Optional D1 FTS index — writes are best-effort (R2 is authoritative). */
  searchIndex?: D1Database,
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

  if (updated.length > 0) {
    const index = await ensureListIndex(bucket, normalizedDomain);
    const updatedSet = new Set(updated);
    const nextIndex = index.map((entry) =>
      updatedSet.has(entry.id) ? { ...entry, readAt } : entry,
    );
    await saveListIndex(bucket, normalizedDomain, nextIndex);

    if (searchIndex) {
      try {
        await updateSearchReadState(searchIndex, updated, readAt);
      } catch (error) {
        console.error("Failed to sync read state to search index", error);
      }
    }
  }

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
