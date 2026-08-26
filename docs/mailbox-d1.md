# Mailbox D1 — `relaybase-mail` (`mailbox_messages` + `mailbox_fts`)

**Audience:** humans and coding agents changing mail search, list/counts, Sent pagination, list virtualization, or the D1 `RELAYBASE_MAIL` binding.

This doc replaces the old `inbound-search-d1-fts5.md` (inbound-only FTS). Mail search + list + counts + Sent are now **one** D1, `relaybase-mail`, for both inbound and sent. R2 stays the source of truth; D1 is fully rebuildable from thin `meta.json` + `raw.eml` via `POST /console/rebuild-mail`.

**Primary code:**

| Area | Paths |
|------|------|
| D1 binding + migration | `server/wrangler.toml` (`RELAYBASE_MAIL`), `server/db/mail/migrations/0001_create_mailbox.sql` |
| Drizzle schema + helpers | `server/db/mail/` (`schema.ts`, `index.ts`, `messages.ts`, `search.ts`) |
| Env type | `server/src/env.ts` (`RELAYBASE_MAIL?: D1Database`) |
| Unified store (R2 + D1) | `server/src/lib/mailbox-store.ts` (`storeInboundMail`, `storeSentMail`, `getMailMessage`, `setMailReadState`, `pruneMail`, `rebuildDomain`) |
| Same-install send → Inbox | `server/src/lib/mail/local-deliver.ts` |
| Counts (`total`/`unread`) | `server/db/mail/messages.ts` (`mailboxCounts`, `mailboxAddressCounts`, `mailboxFreshness`) |
| List cursor | `server/db/mail/messages.ts` (`listMailboxPage`, `parseMailboxCursor`, `encodeMailboxCursor`) |
| FTS5 query + sync | `server/db/mail/search.ts` (`buildMailboxFtsQuery`, `upsertMailboxFts`, `searchMailbox`) |
| Cron reconcile | `server/src/lib/inbound-index-cron.ts` (R2 folders vs D1 ids; never GET `raw.eml` on request path) |
| Backfill endpoint | `server/src/routes/console/rebuild-mail.ts` |
| Freshness endpoint | `server/src/routes/console/mailbox-health.ts` |
| Desktop routes | `server/src/routes/mail/inbox.ts`, `server/src/routes/mail/sent.ts` |
| API v1 routes | `server/src/routes/v1-inbox.ts` |
| Mobile (account-scoped) | `server/src/routes/mobile.ts`, `server/src/lib/mail/list-inbox.ts` |
| Client store | `app/src/email/stores/email-mailbox-store.ts` |
| Disk cache | `app/src/email/lib/disk/email-disk-store.ts` |

Migration layout, `POST /console/init-db`, `POST /console/migrate-db`: **[d1-migrations-and-init-db.md](./d1-migrations-and-init-db.md)**. R2 object layout: **[mailbox-r2.md](./mailbox-r2.md)**.

Read this before adding a search field, changing the FTS5 schema, changing how list totals/unread are computed, or touching the virtualized row component.

---

## Schema

`mailbox_messages` (list/count/cursor):

| Column | Notes |
|--------|-------|
| `id` | PK. Inbound = uuid; sent = RFC Message-ID when present else uuid |
| `kind` | `inbound` \| `sent` |
| `domain` | recipient (inbound) / sender (sent) domain, lowercased |
| `from_email`, `from_name`, `to_email`, `to_emails`, `cc_emails` | headers |
| `recipients` | `,`-joined lowercased To+Cc set — used for account scoping (`LIKE '%,addr,%'`) |
| `subject`, `body_preview` | preview only (≤500 chars); no body |
| `occurred_at` | inbound `receivedAt` / sent `sentAt` (ISO) |
| `message_id`, `in_reply_to`, `refs` | threading |
| `size`, `attachment_count`, `read_at` | `read_at` null for sent |
| `r2_prefix` | `{kind}/{domain}/{id}` for R2 deletes |

Indexes: unique `(domain, kind, message_id) WHERE message_id IS NOT NULL`; `(kind, domain, occurred_at DESC, id DESC)`; partial unread `(kind, domain, read_at) WHERE kind='inbound' AND read_at IS NULL`; `(domain, kind)`.

`mailbox_fts` (FTS5): `subject`, `from_email`, `from_name`, `to_emails`, `cc_emails`, `body_text` (capped excerpt from `raw.eml`); `id`/`kind`/`domain` UNINDEXED.

---

## Why this exists

Mail bodies live only in per-message R2 `raw.eml`. A "search" that opens every `raw.eml` in a domain is O(n) object reads per query — fine for a few hundred messages, unusable at thousands. `mailbox_fts` answers subject/from/to/cc/body queries in one SQL `MATCH`. `mailbox_messages` answers list/counts/cursor without any R2 read on the list path.

D1 is **derived** from R2 thin `meta.json`. The ingest path keeps it in sync (best-effort upsert on store, delete on prune, read-state update). D1 writes must never fail `email()`. A transient D1 miss is reconciled by the cron and fully rebuildable by `POST /console/rebuild-mail`.

---

## Required binding

`RELAYBASE_MAIL` is **required** for list/search/counts. Missing binding → **503**, not a silent `_list.json` fallback. Health JSON reports `d1.mailConfigured`.

---

## Querying

- **List:** `listMailboxPage({ kind, domain, account?, before, limit })` → cursor `{occurred_at}|{id}`. `account` filters by `recipients` membership.
- **Counts:** `mailboxAddressCounts(db, kind, domain)` → per-address `{ total, unread }` (unread inbound only). `mailboxFreshness(db)` → per `(kind, domain)` last `occurred_at` + count (powers `/console/mailbox-health`).
- **Search:** `searchMailbox(db, { kind, domains, q, before, limit, account? })` → `MailboxSearchPage`. `buildMailboxFtsQuery` builds the FTS5 `MATCH` (tokenized, prefix-safe). Sent search uses the same `mailbox_fts` (`kind=sent`); the old in-memory `sentMatchesQuery` over a full array is gone.
- **Detail:** `getMailMessage(bucket, kind, domain, id)` loads thin `meta.json` and parses `raw.eml` on demand. Legacy sent rows without `raw.eml` return preview-only.

---

## Sync model

- **Store:** `storeInboundMail` / `storeSentMail` PUT thin `meta.json` + `raw.eml` + pointer, then `upsertMailboxMessage` + `upsertMailboxFts` (best-effort). Compose/API/mobile send also calls `storeInboundMail` for on-install `inbound_enabled` recipients (`local-deliver.ts`) so Inbox does not depend on Email Routing `email()`.
- **Dedupe:** single-key `by-message-id/{id}` pointer GET only — never a full-domain `meta.json` scan.
- **Prune:** ingest never prunes. Cron reads `app_settings.inbound_retain_per_domain` (`null` = unlimited). When set, `mailboxPruneIds` + batch `pruneMail` (50 prefixes/domain/tick) delete oldest inbound only. Sent is not auto-pruned.
- **Read state:** `setMailReadState` updates thin `meta.json` + `updateMailboxReadState` (D1). Sent has no read state.
- **Cron:** `runInboundIndexCron` lists R2 `{kind}/{domain}/` folders, diffs against D1 ids, upserts only missing thin metas, deletes stale D1 rows, then batch-prunes inbound when a retain cap is set. Never GET `raw.eml` on the request/cron path.

---

## Backfill (`POST /console/rebuild-mail`)

Admin-only, per-domain (pass `?domain=` for large mailboxes). For each domain: thin every inbound fat meta (drop `bodyText`/`bodyHtml`), materialize `sent/{domain}/{id}/meta.json` from legacy `_list.json`/`_sent.json` when no sent folders exist, upsert `mailbox_messages` + `mailbox_fts`, then delete array keys. Returns `{ domains, inbound, sent, deletedKeys }`.

Until rebuild finishes, list is empty or 503 — do not leave a Worker on a mailbox without running rebuild.

---

## Checklist when changing this area

- [ ] New search fields added to `mailbox_fts` require a migration + `rebuildDomain` FTS pass.
- [ ] Never store `bodyText`/`bodyHtml` in `mailbox_messages` or `meta.json`.
- [ ] List/counts/search must 503 (not silently fall back to R2 scans) when `RELAYBASE_MAIL` is unbound.
- [ ] Account scoping uses the `recipients` column (`LIKE '%,addr,%'`), not a runtime To/Cc parse.
- [ ] Do not reintroduce a per-domain array JSON (`_list.json` / `_sent.json`) for lists.
- [ ] Do not prune on the `email()` / store path. Retention is cron-only and optional (`app_settings`).
