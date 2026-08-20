-- Full-text search index over inbound mail (synced from R2 by
-- server/src/lib/inbound-store.ts; backfilled by
-- server/scripts/backfill-inbound-search.mjs).
--
-- Indexed columns: subject, from_email, from_name, to_emails, cc_emails,
-- body_text. UNINDEXED columns are stored (returned in results) but not
-- searchable, so a search hit can be serialized as a list item without
-- touching R2. `refs` holds the RFC `References` header (`references` is a
-- reserved word). `recipients` is the lowercased To+Cc membership list used
-- for exact account scoping on /mobile/inbox/search.
CREATE VIRTUAL TABLE IF NOT EXISTS inbound_search_fts USING fts5(
  id UNINDEXED,
  domain UNINDEXED,
  subject,
  from_email,
  from_name,
  to_email UNINDEXED,
  to_emails,
  cc_emails,
  recipients UNINDEXED,
  body_text,
  body_preview UNINDEXED,
  received_at UNINDEXED,
  message_id UNINDEXED,
  in_reply_to UNINDEXED,
  refs UNINDEXED,
  size UNINDEXED,
  attachment_count UNINDEXED,
  read_at UNINDEXED
);
