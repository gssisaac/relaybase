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

type SentIndexFile = {
  version: typeof SENT_INDEX_VERSION;
  messages: StoredSentEmail[];
};

function sentIndexKey(domain: string): string {
  return `inbound/${domain.trim().toLowerCase()}/_sent.json`;
}

export async function listStoredSent(
  bucket: R2Bucket,
  domain: string,
): Promise<StoredSentEmail[]> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return [];
  const object = await bucket.get(sentIndexKey(normalized));
  if (!object) return [];
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

/**
 * Cursor-paginated sent list (newest first). The whole `_sent.json` index is
 * still loaded server-side (single R2 object) but only one page crosses the
 * wire, and `total` comes for free.
 */
export async function listStoredSentPage(
  bucket: R2Bucket,
  domain: string,
  options: { limit?: number; before?: string } = {},
): Promise<StoredSentPage> {
  const all = await listStoredSent(bucket, domain);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_SENT_PAGE);
  const cursor = parseSentCursor(options.before);
  const filtered = cursor
    ? all.filter((message) => isBeforeSentCursor(message, cursor))
    : all;
  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const last = page[page.length - 1];

  return {
    sent: page,
    nextBefore: hasMore && last ? `${last.sentAt}|${last.id}` : null,
    hasMore,
    total: all.length,
  };
}
