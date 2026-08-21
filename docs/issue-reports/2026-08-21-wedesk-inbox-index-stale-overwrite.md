# Inbox list stuck at Aug 9 after `_list.json` overwrite (wedesk.so)

**Date:** 2026-08-21  
**Status:** Fixed (Worker incremental reconcile + live `_list.json` / D1 repair)  
**Severity:** High (mailbox looked truncated; newest mail appeared 12 days old)  
**Components:** `server/src/lib/inbound-store.ts`, `server/src/lib/inbound-index-cron.ts`, `server/src/lib/inbound-search.ts`, `server/scripts/import-mbox.mjs`, desktop pull-to-refresh (`MailListView`)

## Summary

`isaac@wedesk.so` Inbox showed **2,642** messages with newest **Aug 9**, while R2 still held **2,696** `meta.json` objects (newest **Aug 17 22:25 UTC**). Mail bodies were never deleted. The compact list index `inbound/wedesk.so/_list.json` was overwritten from a stale in-memory snapshot, and D1 `RELAYBASE_INBOX_INDEX` had never caught up for that domain. The first auto-heal attempt then failed on every refresh (`exceededMemory` / `exceededResources`) because it scanned every `meta.json` on the request isolate.

## Symptoms

1. Inbox header **2,642**; list newest **Aug 9, 8:00 AM**. Today was **2026-08-21**.
2. Pull-to-refresh / reopen did not change the list. First heal deploy hung the spinner (full scan on `GET /mail/inbox`).
3. After moving the scan to `waitUntil`, the spinner stopped but the list stayed 2,642 / Aug 9.
4. Other domains (`letssayso.com`, `kloyapp.com`, `isaaclee.xyz`) still had later mail.
5. Local cache `~/.relaybase/s-legacy/mail/desktop/inbox.json` (Aug 20 18:07) still held 47 of the 54 missing rows (newest Aug 17 20:49 UTC).

## Live evidence (dogfood `relaybase-api`)

| Source | wedesk.so |
|--------|-----------|
| Live `_list.json` (before repair) | **2,642** · newest `2026-08-09T01:00:24.000Z` |
| R2 `meta.json` folders | **2,696** |
| D1 `inbound_search_fts` (before repair) | **2,642** · same newest |
| Last inbound `_list.json` write before repair | `2026-08-18T10:06:43Z` |
| Workers Analytics (2026-08-21 06:30 UTC+) | 494 success, **9 `exceededMemory`**, **1 `exceededResources`** |

Aug 19–20 mailbox copy (`relaybase-inbound` → `relaybase-mailbox`) copied the already-broken `_list.json` (byte-identical in both buckets).

## Root cause

Three stacked failures. R2 `meta.json` stayed the source of truth throughout.

### 1. `import-mbox.mjs` whole-file overwrite

The Gmail Takeout importer (dogfood only) loads `_list.json` once and writes it back whole-file at the end (`flushListIndex`). Live ingest during that run landed as `meta.json` but was missing from the in-memory snapshot, so the final put silently dropped those ids from the compact index. Inbox UI reads `_list.json` only (`listInboundEmailsPage` → `ensureListIndex`).

### 2. D1-on-ingest was not live yet

D1 upsert on ingest landed in commit `79bee1f` (Aug 18) and first deployed **Aug 19 18:02 UTC**. Before that, ingest never wrote FTS. After deploy it worked (`letssayso.com` D1 row Aug 20 07:04). Wedesk had no new objects after Aug 18 10:06, so the gap stayed in both `_list.json` and D1.

### 3. First auto-heal scanned every body and died

The first reconcile compared folder count to list length and, on mismatch, `GET` every `meta.json` (bodies included) plus D1 upsert of all rows:

1. Doing that **on the inbox GET path** exceeded Worker limits → refresh hung.
2. `countMetaFolders` initially counted `inbound/{domain}/by-message-id/` as a message folder, so the count **always** mismatched and rebuild ran on every first-page request.
3. Moving the same full scan to `waitUntil` / cron still died: **9 `exceededMemory`**, **1 `exceededResources`**. `saveListIndex` runs after the scan, so `_list.json` and D1 never updated.

## Fix

1. **Request path** — serve current `_list.json` immediately (`verify: false`). Never scan bodies on `GET /mail/inbox`.
2. **Background reconcile** — `waitUntil(reconcileInboundIndexIfDrifted)` on first-page inbox + counts, plus `scheduled()` cron (`*/15 * * * *`).
3. **Incremental merge** — list `{id}/` folders (skip `by-message-id/`), GET only **missing** `meta.json`, merge into `_list.json`, upsert those rows to D1. Full-body scan is only for a missing index, not drift repair.
4. **Desktop** — pull-to-refresh with a 15s abort / 12s spinner timeout so a slow Worker cannot wedge the list.
5. **import-mbox.mjs** — marked dogfood-only; documents the stale overwrite. Future production import must go through Worker store helpers.
6. **Architecture** — Self-heal section in `docs/inbound-search-d1-fts5.md`.

## Repair applied (2026-08-21)

- Worker redeploy with incremental merge: version `d472fd88-8ad6-46fe-bc8f-fd8aeca78329` (`https://relaybase-api.gssisaac.workers.dev`).
- Live `_list.json` merged: **2,696** entries, newest `2026-08-17T22:25:54.169Z` (`Data migration service: Request for authorization`).
- D1 backfill `node scripts/backfill-inbound-search.mjs --domain wedesk.so`: **2,696** rows, same newest.

A later folder vs list check showed **2,692** on `_list.json` (four folders without a loadable `meta.json`). Inbox newest remained Aug 17.

## Verification

- [x] Workers Analytics showed `exceededMemory` / `exceededResources` on the full-scan heal
- [x] After incremental deploy + merge: `_list.json` count ≥ 2,692, newest `2026-08-17T22:25:54.169Z`
- [x] D1 `SELECT COUNT(*), MAX(received_at) FROM inbound_search_fts WHERE domain='wedesk.so'` → `2696` / `2026-08-17T22:25:54.169Z`
- [ ] Desktop: Inbox pull-to-refresh shows count ~2,692 and mail after Aug 9 (local cache must be replaced)

## Out of scope

- Why wedesk.so received no new R2 objects after Aug 18 10:06 UTC (possible Email Routing / ingest gap, separate from this index bug)
- Production Gmail Takeout import (script stays dogfood-only)
- BIMI / VMC inbox brand marks

## Related

- Architecture: [inbound-search-d1-fts5.md](../inbound-search-d1-fts5.md) (Self-heal)
- Storage: [mailbox-r2.md](../mailbox-r2.md), [storage-architecture.md](../storage-architecture.md)
