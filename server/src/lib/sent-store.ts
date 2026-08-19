export type StoredSentEmail = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  bodyPreview: string;
  sentAt: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

const SENT_INDEX_VERSION = 1 as const;
const MAX_SENT = 5000;
const PREFIX = "sent";

type SentIndexFile = {
  version: typeof SENT_INDEX_VERSION;
  messages: StoredSentEmail[];
};

const JSON_META = { httpMetadata: { contentType: "application/json" } };

function sentIndexKey(domain: string): string {
  return `${PREFIX}/${domain.trim().toLowerCase()}/_list.json`;
}

/** Pre-mailbox-bucket location (Takeout import wrote under inbound/). */
function legacySentIndexKey(domain: string): string {
  return `inbound/${domain.trim().toLowerCase()}/_sent.json`;
}

async function parseSentIndex(object: R2ObjectBody): Promise<StoredSentEmail[]> {
  try {
    const parsed = JSON.parse(await object.text()) as SentIndexFile;
    if (parsed.version !== SENT_INDEX_VERSION || !Array.isArray(parsed.messages)) {
      return [];
    }
    return [...parsed.messages].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  } catch {
    return [];
  }
}

export async function listStoredSent(
  bucket: R2Bucket,
  domain: string,
): Promise<StoredSentEmail[]> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return [];
  const object = await bucket.get(sentIndexKey(normalized));
  if (object) return parseSentIndex(object);
  const legacy = await bucket.get(legacySentIndexKey(normalized));
  if (!legacy) return [];
  return parseSentIndex(legacy);
}

export async function upsertStoredSent(
  bucket: R2Bucket,
  domain: string,
  message: StoredSentEmail,
): Promise<StoredSentEmail> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return message;
  const existing = await listStoredSent(bucket, normalized);
  const next = [
    message,
    ...existing.filter((row) => {
      if (row.id === message.id) return false;
      if (message.messageId && row.messageId === message.messageId) return false;
      return true;
    }),
  ]
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, MAX_SENT);
  await bucket.put(
    sentIndexKey(normalized),
    JSON.stringify({ version: SENT_INDEX_VERSION, messages: next } satisfies SentIndexFile),
    JSON_META,
  );
  return message;
}

export type StoredSentPage = {
  sent: StoredSentEmail[];
  /** Cursor for the next page: `{sentAt}|{id}`. */
  nextBefore: string | null;
  hasMore: boolean;
  /** Total sent messages for the domain (whole index, not this page). */
  total: number;
};

function parseSentCursor(
  before: string | undefined,
): { sentAt: string; id: string | null } | null {
  const raw = before?.trim();
  if (!raw) return null;
  const sep = raw.lastIndexOf("|");
  if (sep <= 0) return { sentAt: raw, id: null };
  return { sentAt: raw.slice(0, sep), id: raw.slice(sep + 1) || null };
}

function isBeforeSentCursor(
  message: StoredSentEmail,
  cursor: { sentAt: string; id: string | null },
): boolean {
  const byDate = message.sentAt.localeCompare(cursor.sentAt);
  if (byDate < 0) return true;
  if (byDate > 0) return false;
  if (!cursor.id) return false;
  return message.id.localeCompare(cursor.id) < 0;
}

const MAX_SENT_PAGE = 5000;

function sentMatchesQuery(message: StoredSentEmail, tokens: string[]): boolean {
  const haystack = [
    message.subject,
    message.to,
    message.cc ?? "",
    message.from,
    message.bodyPreview,
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Cursor-paginated sent list (newest first), with optional `q` substring
 * search over subject/to/cc/from/preview. The whole `_list.json` index is
 * still loaded server-side (single R2 object) but only one page crosses the
 * wire; `total` counts the (search-filtered) index, not the page.
 */
export async function listStoredSentPage(
  bucket: R2Bucket,
  domain: string,
  options: { limit?: number; before?: string; q?: string } = {},
): Promise<StoredSentPage> {
  const all = await listStoredSent(bucket, domain);
  const tokens = (options.q ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const matching = tokens.length
    ? all.filter((message) => sentMatchesQuery(message, tokens))
    : all;
  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_SENT_PAGE);
  const cursor = parseSentCursor(options.before);
  const filtered = cursor
    ? matching.filter((message) => isBeforeSentCursor(message, cursor))
    : matching;
  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const last = page[page.length - 1];

  return {
    sent: page,
    nextBefore: hasMore && last ? `${last.sentAt}|${last.id}` : null,
    hasMore,
    total: matching.length,
  };
}
