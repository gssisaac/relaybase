# Mailbox R2 — `relaybase-mailbox`

**Audience:** humans and coding agents changing inbound/sent object keys, the R2 bucket name, send-log storage, or mailbox install/copy scripts.

**Primary code:**

| Area | Paths |
|------|--------|
| Worker binding | `server/wrangler.toml` (`INBOUND` → bucket `relaybase-mailbox`, var `INBOUND_BUCKET_NAME`) |
| Customer install template | `server/customer-install/wrangler.toml`, `server/customer-install/README.md` |
| Desktop auto-install | `desktop/src-tauri/src/auto_install.rs`, `desktop/src-tauri/src/worker.rs` (`R2_BUCKET`) |
| **Mailbox store (inbound + sent)** | `server/src/lib/mailbox-store.ts` |
| Send history | `server/src/lib/send-logs.ts` (`sent/_sendlog/{id}.json`, no `_index.json`) |
| Compose / API persist | `server/src/lib/mail/send-message.ts`, `server/routes/send.ts` |
| One-time backfill | `server/src/routes/console/rebuild-mail.ts`, `rebuildDomain` in `mailbox-store.ts` |
| Bucket-to-bucket copy (Worker) | `server/scripts/copy-mailbox-r2.mjs`, `server/scripts/mailbox-copy-worker/` |

Storage map and forbidden stores: **[storage-architecture.md](./storage-architecture.md)**. D1 mail index (`relaybase-mail`): **[mailbox-d1.md](./mailbox-d1.md)**. Ops-event D1 log (additive, not send history): **[ops-log-d1.md](./ops-log-d1.md)**.

---

## What changed (2026-08-24) — kill `list.json`, unify mail D1

The per-domain array JSON indexes are gone. R2 now holds **one folder per mail**; lists/search/counts come from D1 `relaybase-mail`.

| Before | After |
|--------|--------|
| `inbound/{domain}/_list.json` (array of all messages) | deleted — list is `SELECT mailbox_messages` |
| `inbound/{domain}/{id}/meta.json` with `bodyText`/`bodyHtml` | thin `meta.json` (headers + `bodyPreview` only) + `raw.eml` |
| `sent/{domain}/_list.json` (array) | `sent/{domain}/{id}/meta.json` (+ `raw.eml` when compose/API wrote MIME) |
| `sent/_sendlog/_index.json` | deleted — `listSendLogs` does `bucket.list({ prefix: "sent/_sendlog/" })` |
| `RELAYBASE_INBOX_INDEX` D1 (inbound FTS only) | `RELAYBASE_MAIL` D1 (`mailbox_messages` + `mailbox_fts`, inbound **and** sent) |
| Message-ID dedupe = full-domain `meta.json` scan (the `wedesk.so` ingest killer) | single-key `by-message-id/{id}` pointer GET |

The Worker **binding name stays `INBOUND`**. The bucket name `relaybase-mailbox` is unchanged. Only object keys and the D1 binding changed.

Cutover is **code first → `POST /console/rebuild-mail` once → delete array keys**. Until rebuild finishes on a mailbox, lists are empty or 503 — do not leave a Worker on a mailbox without running rebuild.

---

## Object layout

```text
relaybase-mailbox/
  inbound/{domain}/{id}/meta.json | raw.eml | attachments/{aid}-{name}
  inbound/{domain}/by-message-id/{encodedMessageId}     # pointer → id (text)

  sent/{domain}/{id}/meta.json | raw.eml | attachments/{aid}-{name}
  sent/{domain}/by-message-id/{encodedMessageId}

  sent/_sendlog/{uuid}.json                            # no _index.json
```

Deleted after backfill: `inbound/{domain}/_list.json`, `sent/{domain}/_list.json`, `inbound/{domain}/_sent.json`, `sent/_sendlog/_index.json`.

### `meta.json` contract (THIN)

Headers, `bodyPreview` (≤500 chars), `attachments[]`, `occurredAt` (inbound `receivedAt` / sent `sentAt`), `readAt` (inbound only), `messageId`, `inReplyTo`, `references`, `size`, `hasText`, `hasHtml`. **No `bodyText` / `bodyHtml` keys.** Detail APIs parse `raw.eml` on demand via `parseInboundMime`.

Legacy sent rows imported from `_list.json` have **no `raw.eml`** (only `bodyPreview`); `hasText`/`hasHtml` stay false and the detail endpoint returns preview-only. Recovering those bodies is explicitly out of scope.

Broadcasts still write `sent/_sendlog/*` only — they do **not** insert every recipient into `mailbox_messages`.

---

## Why there is no bucket rename

Cloudflare R2 cannot rename a bucket. Moving the name is always create + copy + rebind + delete the old bucket.

Do **not** GET+PUT ~8k objects through a laptop. That path is slow and dies on transient `fetch failed`. Copy **inside Cloudflare** with the short-lived Worker in `server/scripts/mailbox-copy-worker/` (SRC + DST bindings).

Dashboard **Object count / Storage size** are eventual-consistency rollups. After a copy they can lag the live list API by hours. Trust `GET /accounts/…/r2/buckets/{name}/objects` (or a Worker `bucket.list`), not the dashboard cards, when checking completeness.

---

## Operator cutover (dogfood `relaybase-api`, account `3adf03…`)

1. Create + bind `relaybase-mail` D1 (`wrangler d1 create relaybase-mail`, set `database_id` in `wrangler.toml`).
2. `cd server && pnpm run build:bundle` → deploy.
3. `POST /console/migrate-db` (creates `mailbox_messages` + `mailbox_fts`).
4. `POST /console/rebuild-mail` (one-time backfill: thin metas, materialize sent, fill D1+FTS, delete array keys). Pass `?domain=` to rebuild one domain at a time on large mailboxes.
5. Confirm Inbox / Sent / search; then **delete `relaybase-inbox-index`** so the account stays at 3 D1s.
6. Pull-to-refresh desktop so the `~/.relaybase` inbox/sent disk cache dies.

Until rebuild finishes, list is empty or 503 — do not leave this Worker on a mailbox without running rebuild.

---

## R2 subscription (required)

Cloudflare will not create or list buckets until the account has R2. A first install can succeed, then a few days later Cloudflare may drop the unused **$0** subscription. API calls then return **403** with code **10042** (`Please enable R2 through the Cloudflare Dashboard`).

Desktop auto-install checks this **before** deleting or creating Worker / R2 / D1. The UI links to the account R2 overview — not checkout:

`https://dash.cloudflare.com/{account_id}/r2`

From that page the user can add R2 back if Cloudflare prompts. Do not deep-link `/r2/checkout/payment`.

---

## Verify

```bash
curl -sS https://<worker>/health
# inbound.r2Configured === true
# inbound.bucketName === "relaybase-mailbox"
# d1.mailConfigured === true

curl -sS -H "Authorization: Bearer <admin>" https://<worker>/console/mailbox-health
# per-domain last inbound + stale flag

curl -sS -X POST -H "Authorization: Bearer <admin>" https://<worker>/console/rebuild-mail
# { domains, inbound, sent, deletedKeys }
```

Cloudflare script settings must show `r2_bucket INBOUND` → `relaybase-mailbox` and `d1_database RELAYBASE_MAIL` → `relaybase-mail`.

---

## Checklist when changing this area

- [ ] New mail objects stay under `inbound/{domain}/{id}/` or `sent/{domain}/{id}/` — never reintroduce a per-domain array JSON.
- [ ] `meta.json` never contains `bodyText` / `bodyHtml`; bodies live only in `raw.eml`.
- [ ] Message-ID dedupe uses the `by-message-id/{id}` pointer only — never a full-domain `meta.json` scan.
- [ ] Binding name remains `INBOUND` unless desktop upload metadata (`cloudflare.rs`) and health JSON are updated together.
- [ ] `recordSendLog` / `listSendLogs` take the R2 bucket and never touch `_index.json`.
- [ ] Successful compose and `/v1/send` write `sent/{domain}/{id}/` + upsert `mailbox_messages` `kind=sent`.
- [ ] Customer-install + desktop `R2_BUCKET` stay `relaybase-mailbox`.
- [ ] Treat dashboard object-count cards as stale; use list API for migration checks.
- [ ] Inbound retention is `app_settings.inbound_retain_per_domain` (default unlimited). Do not reintroduce a hard 5000 cap on ingest.
