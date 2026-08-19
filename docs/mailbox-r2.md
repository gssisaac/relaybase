# Mailbox R2 — `relaybase-mailbox`

**Audience:** humans and coding agents changing inbound/sent object keys, the R2 bucket name, send-log storage, or mailbox install/copy scripts.

**Primary code:**

| Area | Paths |
|------|--------|
| Worker binding | `server/wrangler.toml` (`INBOUND` → bucket `relaybase-mailbox`, var `INBOUND_BUCKET_NAME`) |
| Customer install template | `server/customer-install/wrangler.toml`, `server/customer-install/README.md` |
| Desktop auto-install | `desktop/src-tauri/src/auto_install.rs`, `desktop/src-tauri/src/worker.rs` (`R2_BUCKET`) |
| Inbound objects | `server/src/lib/inbound-store.ts` (`inbound/{domain}/…`) |
| Mailbox Sent index | `server/src/lib/sent-store.ts` (`sent/{domain}/_list.json`) |
| Send history | `server/src/lib/send-logs.ts` (`sent/_sendlog/…`) |
| Compose / API persist | `server/src/lib/mail/send-message.ts`, `server/src/routes/send.ts` |
| In-place key rename + KV send-log export | `server/scripts/migrate-mailbox-r2.mjs` |
| Bucket-to-bucket copy (Worker) | `server/scripts/copy-mailbox-r2.mjs`, `server/scripts/mailbox-copy-worker/` |

Storage map and forbidden stores: **[storage-architecture.md](./storage-architecture.md)**. Ops-event D1 log (additive, not send history): **[ops-log-d1.md](./ops-log-d1.md)**.

---

## What changed (2026-08-20)

The product R2 bucket is no longer inbound-only.

| Before | After |
|--------|--------|
| Bucket `relaybase-inbound` | Bucket `relaybase-mailbox` |
| Sent mailbox index at `inbound/{domain}/_sent.json` (Takeout import only) | `sent/{domain}/_list.json` (compose, `/v1/send`, Takeout) |
| Send history in KV `srv:sendlog:*` | R2 `sent/_sendlog/_index.json` + `sent/_sendlog/{id}.json` |
| Compose wrote D1 ops log only | Compose also writes send-log + mailbox Sent |

The Worker **binding name stays `INBOUND`**. Only the Cloudflare bucket name and object-key prefixes changed.

New customer installs create `relaybase-mailbox` from day one (`server/customer-install/`, desktop auto-install).

---

## Object layout

```text
relaybase-mailbox/
  inbound/{domain}/_list.json
  inbound/{domain}/{id}/meta.json | raw.eml | attachments/…
  inbound/{domain}/by-message-id/{encodedMessageId}

  sent/{domain}/_list.json
  sent/_sendlog/_index.json
  sent/_sendlog/{uuid}.json
```

`listStoredSent` still reads legacy `inbound/{domain}/_sent.json` if the new `_list.json` is missing.

Broadcasts write `sent/_sendlog/*` only — they do **not** append every recipient into the mailbox Sent folder.

---

## Why there is no bucket rename

Cloudflare R2 cannot rename a bucket. Moving the name is always create + copy + rebind + delete the old bucket.

Do **not** GET+PUT ~8k objects through a laptop. That path is slow and dies on transient `fetch failed`. Copy **inside Cloudflare** with the short-lived Worker in `server/scripts/mailbox-copy-worker/` (SRC + DST bindings).

Dashboard **Object count / Storage size** are eventual-consistency rollups. After a copy they can lag the live list API by hours. Trust `GET /accounts/…/r2/buckets/{name}/objects` (or a Worker `bucket.list`), not the dashboard cards, when checking completeness.

---

## Dogfood migration (already applied)

Account `3adf03d991843094a7343eebc0a98007`, Worker `relaybase-api`:

1. In-place on `relaybase-inbound`: rename `inbound/wedesk.so/_sent.json` → `sent/wedesk.so/_list.json`; write 35 KV send logs to `sent/_sendlog/*`.
2. Worker-copy all keys `relaybase-inbound` → `relaybase-mailbox` (8,349 = 8,349). Copy Worker `relaybase-mailbox-copy` deleted after the run.
3. Product Worker rebound: `INBOUND` + `INBOUND_BUCKET_NAME` = `relaybase-mailbox`. Verified `GET /health` → `r2Configured: true`, `bucketName: "relaybase-mailbox"`.

`relaybase-inbound` remains as a read-only backup until Inbox / Sent / Logs look right, then delete it.

Re-run (another install) from `server/`:

```bash
# 1) Prefix rename + KV send-log export on the *source* bucket
pnpm run migrate:mailbox-r2          # dry-run
pnpm run migrate:mailbox-r2:apply

# 2) Server-side copy source → relaybase-mailbox
pnpm run copy:mailbox-r2             # dry-run
pnpm run copy:mailbox-r2:apply

# 3) Point wrangler.toml at relaybase-mailbox, then:
pnpm run deploy
```

Requires `CLOUDFLARE_API_TOKEN` (R2 + Workers edit) and `CLOUDFLARE_ACCOUNT_ID`.

---

## Verify

```bash
curl -sS https://<worker>/health
# inbound.r2Configured === true
# inbound.bucketName === "relaybase-mailbox"
```

Cloudflare script settings must show `r2_bucket INBOUND` → `relaybase-mailbox`.

List both buckets via the R2 REST API and compare key counts / `inbound/` vs `sent/` prefixes before deleting the legacy bucket.

---

## Checklist when changing this area

- [ ] New mail objects stay under `inbound/` or `sent/` — do not invent a third top-level prefix without updating this doc and the copy Worker.
- [ ] Binding name remains `INBOUND` unless desktop upload metadata (`cloudflare.rs`) and health JSON are updated together.
- [ ] `recordSendLog` / `listSendLogs` take the R2 bucket, not `RELAYBASE_APP` KV.
- [ ] Successful compose and `/v1/send` upsert `sent/{domain}/_list.json`.
- [ ] Customer-install + desktop `R2_BUCKET` stay `relaybase-mailbox`.
- [ ] Treat dashboard object-count cards as stale; use list API for migration checks.
