/**
 * `relaybase-inbox-index` schema.
 *
 * `inbound_search_fts` is an FTS5 virtual table created by
 * `server/migrations-inbox/0001_create_inbound_search.sql`. Drizzle cannot
 * model FTS5 columns as a regular `sqliteTable`, so this module only exposes
 * a typed row shape + a `sql` fragment for the table name used in raw
 * queries. Do NOT generate a fresh CREATE from this schema.
 */
import { sql } from "drizzle-orm";

export const inboundSearchFts = sql.identifier("inbound_search_fts");

export type InboundSearchRow = {
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
