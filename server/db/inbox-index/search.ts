import { sql } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import type { InboxIndexDb } from "./index";
import type { InboundEmailMeta } from "../../src/lib/inbound-store";

export type InboundSearchOptions = {
  domains: string[];
  q: string;
  limit?: number;
  /** Cursor: `{receivedAt}|{id}` (same shape as the R2 list cursor). */
  before?: string;
  /** Restrict to messages addressed to this account (To + Cc membership). */
  account?: string;
};

export type InboundSearchPage = {
  messages: InboundEmailMeta[];
  total: number;
  nextBefore: string | null;
  hasMore: boolean;
};

const TABLE = "inbound_search_fts";
const MAX_SEARCH_LIMIT = 200;
export const MIN_SEARCH_QUERY_LENGTH = 2;
/** Cap indexed body text; full bodies stay in R2 meta.json. */
const MAX_BODY_TEXT = 100_000;

type SearchRow = {
  id: string;
  domain: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  to_emails: string | null;
  cc_emails: string | null;
  body_preview: string;
  received_at: string;
  message_id: string | null;
  in_reply_to: string | null;
  refs: string | null;
  size: number;
  attachment_count: number;
  read_at: string | null;
};

/**
 * Build a safe FTS5 MATCH expression from raw user input: split on
 * whitespace, quote each token (doubling embedded quotes) and add a `*`
 * prefix-match suffix. Tokens are implicitly ANDed by FTS5.
 * Returns null when there is nothing searchable.
 */
export function buildFtsMatchQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/"/g, '""'))
    .filter((token) => /[^\s*]/.test(token));
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(" ");
}

function splitAddressList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinAddressList(value: string[] | undefined): string {
  return (value ?? []).map((entry) => entry.trim()).filter(Boolean).join(",");
}

/** Lowercased To + Cc membership list used for exact account filtering. */
function recipientsColumn(meta: InboundEmailMeta): string {
  const addresses = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) addresses.add(trimmed);
  };
  add(meta.toEmail);
  for (const to of meta.toEmails ?? []) add(to);
  for (const cc of meta.ccEmails ?? []) add(cc);
  return [...addresses].join(",");
}

function rowToMeta(row: SearchRow): InboundEmailMeta {
  return {
    id: row.id,
    domain: row.domain,
    fromEmail: row.from_email,
    fromName: row.from_name ?? undefined,
    toEmail: row.to_email,
    toEmails: splitAddressList(row.to_emails),
    ccEmails: splitAddressList(row.cc_emails),
    subject: row.subject,
    receivedAt: row.received_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    bodyPreview: row.body_preview,
    bodyText: "",
    bodyHtml: null,
    attachments: Array.from(
      { length: row.attachment_count },
      (_, index) => ({
        id: String(index),
        filename: "",
        contentType: "application/octet-stream",
        size: 0,
        disposition: "attachment",
        contentId: null,
      }),
    ),
    readAt: row.read_at,
  };
}

/**
 * Insert (or replace) the search row for one message. FTS5 tables have no
 * unique constraint, so replace = delete-by-id + insert in one batch.
 * Uses drizzle `sql` templates for parameter binding.
 */
export async function upsertSearchRows(
  db: InboxIndexDb,
  metas: InboundEmailMeta[],
): Promise<void> {
  if (!db || metas.length === 0) return;
  for (const meta of metas) {
    await db.run(sql`DELETE FROM ${sql.raw(TABLE)} WHERE id = ${meta.id}`);
    await db.run(
      sql`INSERT INTO ${sql.raw(TABLE)} (
        id, domain, subject, from_email, from_name, to_email, to_emails,
        cc_emails, recipients, body_text, body_preview, received_at,
        message_id, in_reply_to, refs, size, attachment_count, read_at
      ) VALUES (
        ${meta.id}, ${meta.domain}, ${meta.subject}, ${meta.fromEmail},
        ${meta.fromName ?? null}, ${meta.toEmail},
        ${joinAddressList(meta.toEmails)}, ${joinAddressList(meta.ccEmails)},
        ${recipientsColumn(meta)}, ${(meta.bodyText ?? "").slice(0, MAX_BODY_TEXT)},
        ${meta.bodyPreview}, ${meta.receivedAt}, ${meta.messageId},
        ${meta.inReplyTo}, ${meta.references}, ${meta.size},
        ${meta.attachments?.length ?? 0}, ${meta.readAt ?? null}
      )`,
    );
  }
}

export async function deleteSearchRows(
  db: InboxIndexDb,
  ids: string[],
): Promise<void> {
  if (!db || ids.length === 0) return;
  for (const id of ids) {
    await db.run(sql`DELETE FROM ${sql.raw(TABLE)} WHERE id = ${id}`);
  }
}

export async function updateSearchReadState(
  db: InboxIndexDb,
  ids: string[],
  readAt: string | null,
): Promise<void> {
  if (!db || ids.length === 0) return;
  for (const id of ids) {
    await db.run(
      sql`UPDATE ${sql.raw(TABLE)} SET read_at = ${readAt} WHERE id = ${id}`,
    );
  }
}

function parseSearchCursor(
  before: string | undefined,
): { receivedAt: string; id: string | null } | null {
  const raw = before?.trim();
  if (!raw) return null;
  const sep = raw.lastIndexOf("|");
  if (sep <= 0) return { receivedAt: raw, id: null };
  return { receivedAt: raw.slice(0, sep), id: raw.slice(sep + 1) || null };
}

/**
 * Full-text search over the inbound index. Results are flat messages (no
 * thread grouping) sorted `receivedAt` desc, paginated with the same
 * `{receivedAt}|{id}` cursor as the R2 list. `total` counts every match
 * regardless of the cursor.
 *
 * FTS5 virtual tables cannot use the drizzle query builder, so this falls
 * back to the raw D1 client (`db.$client`) for the dynamic MATCH + IN + LIKE
 * query.
 */
export async function searchInboundEmails(
  db: InboxIndexDb,
  options: InboundSearchOptions,
): Promise<InboundSearchPage> {
  const domains = options.domains
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const match = buildFtsMatchQuery(options.q);
  if (!db || domains.length === 0 || !match) {
    return { messages: [], total: 0, nextBefore: null, hasMore: false };
  }

  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_SEARCH_LIMIT);
  const cursor = parseSearchCursor(options.before);
  const account = options.account?.trim().toLowerCase() || null;

  const domainPlaceholders = domains.map(() => "?").join(", ");
  const conditions = [`${TABLE} MATCH ?`, `domain IN (${domainPlaceholders})`];
  const baseParams: (string | number)[] = [match, ...domains];
  if (account) {
    conditions.push(`(',' || recipients || ',') LIKE ?`);
    baseParams.push(`%,${account},%`);
  }

  const countSql = `SELECT COUNT(*) AS total FROM ${TABLE} WHERE ${conditions.join(" AND ")}`;
  const countParams = [...baseParams];

  const pageConditions = [...conditions];
  const pageParams = [...baseParams];
  if (cursor) {
    if (cursor.id) {
      pageConditions.push(`(received_at < ? OR (received_at = ? AND id < ?))`);
      pageParams.push(cursor.receivedAt, cursor.receivedAt, cursor.id);
    } else {
      pageConditions.push(`received_at < ?`);
      pageParams.push(cursor.receivedAt);
    }
  }
  const pageSql = `SELECT id, domain, subject, from_email, from_name, to_email, to_emails,
      cc_emails, body_preview, received_at, message_id, in_reply_to, refs,
      size, attachment_count, read_at
    FROM ${TABLE}
    WHERE ${pageConditions.join(" AND ")}
    ORDER BY received_at DESC, id DESC
    LIMIT ?`;
  pageParams.push(limit + 1);

  const raw: D1Database = db.$client;
  try {
    const [countResult, pageResult] = await Promise.all([
      raw.prepare(countSql).bind(...countParams).all<{ total: number }>(),
      raw.prepare(pageSql).bind(...pageParams).all<SearchRow>(),
    ]);

    const total = Number(countResult.results?.[0]?.total ?? 0);
    const rows = pageResult.results ?? [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];

    return {
      messages: page.map(rowToMeta),
      total,
      nextBefore: hasMore && last ? `${last.received_at}|${last.id}` : null,
      hasMore,
    };
  } catch (error) {
    console.error("Failed to search inbound emails", error);
    return { messages: [], total: 0, nextBefore: null, hasMore: false };
  }
}
