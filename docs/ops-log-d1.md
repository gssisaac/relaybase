# Ops Log (D1) & Dashboard Log page

**Audience:** humans and coding agents changing send/bounce logging, the Dashboard Log page, or D1 `RELAYBASE_LOGS`.

**Primary code:**

| Area | Paths |
|------|------|
| D1 binding + migration | `server/wrangler.toml` (`RELAYBASE_LOGS`), `server/db/log/migrations/0001_ops_logs.sql` |

See also: **[d1-migrations-and-init-db.md](./d1-migrations-and-init-db.md)**.
| Drizzle schema + helper | `server/db/log/` (`schema.ts`, `ops-log.ts`, `index.ts`) |
| Env type | `server/src/env.ts` (`RELAYBASE_LOGS?: D1Database`) |
| Log helper | `server/src/lib/ops-logs.ts` (`recordOpsLog`, `listOpsLogs`) |
| Bounce detection | `server/src/lib/bounce-detect.ts` |
| Compose send (writes log + returns Sent) | `server/src/routes/admin-send.ts` |
| API send (dual-write KV + D1) | `server/src/routes/send.ts` |
| Broadcast send (dual-write KV + D1) | `server/src/lib/catalog-broadcasts.ts` |
| Inbound bounce logging | `server/src/inbound.ts`, `server/src/lib/inbound-store.ts` |
| Logs API | `server/src/routes/console/ops-logs.ts` → `/console/ops-logs` |
| D1 probe helper | `server/src/lib/d1-status.ts` (`probeD1Connection`) |
| Connect probe (D1 + R2) | `server/src/routes/console/connect.ts` → `/console/connect` |
| Client mapping | `app/src/lib/desktop/api/email-api-map.ts` (`/api/email/logs` → `/console/ops-logs`) |
| Connection status UI | `app/src/lib/dashboard/connection-status.ts`, `app/src/console/pages/dashboard/ConnectionStatusCards.tsx`, `app/src/console/pages/settings/SettingsTabLayout.tsx` |
| Dashboard nav | `app/src/console/lib/paths.ts` (Log tab after API Keys) |
| Dashboard route | `app/src/app/(shell)/logs/page.tsx` |
| Log page UI | `app/src/console/pages/logs/LogsView.tsx` |

Read this before changing send/bounce logging, adding a Log page event kind, or touching `ops_log` schema.

---

## Why a second log store

Relaybase already had send history in `server/src/lib/send-logs.ts` (now R2 `sent/_sendlog/*`; previously KV `srv:sendlog:*`). That store is **authoritative** for Account Logs (`/console/stats/account-logs`) and the admin server's send-log reads (formerly the legacy `/admin/logs` worker route). Do **not** point those at D1.

Two gaps motivated D1 `RELAYBASE_LOGS`:

1. **Compose (`/mail/send`) was invisible.** Desktop compose never wrote any log, so a failed forward showed up only as a toast — nothing in the dashboard.
2. **Async bounces were invisible.** CF Email Sending returns a bounce DSN later as inbound mail. Without parsing it, the inbox shows `(empty message)` and no failure is recorded anywhere.

D1 `ops_log` is an **additional** event log that covers compose, API, broadcast, and inbound bounce events in one queryable table. KV send logs stay untouched.

---

## Schema

`server/db/log/migrations/0001_ops_logs.sql`:

```sql
CREATE TABLE IF NOT EXISTS ops_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,          -- send | bounce | api_error | inbound
  ok INTEGER NOT NULL,
  status INTEGER,
  source TEXT,                 -- compose | api | broadcast | inbound
  domain TEXT,
  from_addr TEXT,
  to_addr TEXT,
  subject TEXT,
  message_id TEXT,
  error TEXT,
  key_id TEXT,
  key_prefix TEXT,
  meta_json TEXT                -- CF permanent_bounces, DSN status, etc.
);
CREATE INDEX IF NOT EXISTS ops_log_at_idx ON ops_log (at DESC);
CREATE INDEX IF NOT EXISTS ops_log_ok_idx ON ops_log (ok, at DESC);
CREATE INDEX IF NOT EXISTS ops_log_domain_idx ON ops_log (domain);
CREATE INDEX IF NOT EXISTS ops_log_kind_idx ON ops_log (kind, at DESC);
```

Migrations live in `server/db/log/migrations/` (separate from `db/app/migrations/` and `db/mail/migrations/`) so D1 migration directories never collide. Applied by `POST /console/init-db` (empty D1) or `POST /console/migrate-db` (existing).

---

## Events recorded

| Source | Route | Kinds | Notes |
|--------|-------|-------|-------|
| Compose | `POST /mail/send` | `send`, `api_error` | Validation errors, all-bounce, CF exception, success, partial bounce. Also returns a `sent` object so the client upserts Sent. |
| API | `POST /v1/send` | `send`, `api_error` | Dual-write: R2 `sent/_sendlog/*` + D1 `ops_log` (+ mailbox `sent/{domain}/{id}/` + D1 `mailbox_messages` `kind=sent` on success). Partial bounce keeps send-log `ok: true` but D1 `ok: false` so the dashboard catches it. |
| Broadcast | `catalog-broadcasts.ts` | `send` | Dual-write per recipient (KV + D1). |
| Inbound | `server/src/inbound.ts` / `email()` | `inbound`, `bounce` | Every `email()` store success or throw is `kind=inbound` (`created` in `meta_json`). Detected DSN bounces also write `kind=bounce` via `bounce-detect.ts`. Dashboard Log shows receive as empty when Routing never invokes `email()`. |

`recordOpsLog` soft-fails (returns `null`, logs to `console.error`) when `RELAYBASE_LOGS` is missing — customer installs without the binding keep working.

---

## Bounce detection

`server/src/lib/bounce-detect.ts` flags a message as a bounce when:

- `from` matches `bounces@cf-bounce.*` (Cloudflare Email Routing/Sending), or
- the raw MIME head contains `content-type: multipart/report` / `message/delivery-status`, or
- `Auto-Submitted: auto-generated`.

`parseBounceDiagnostic` scans the first ~8 KB of raw MIME for `Final-Recipient`, `Diagnostic-Code`, and `Status` headers (DSN RFC 3464). `buildBouncePreview` produces a human-readable string like `Bounce: Status 5.1.1 — 550 … — to isaac@wedesk.so`.

`server/src/lib/inbound-store.ts` uses this so a bounce with an empty body still stores a non-empty `bodyText` / `bodyPreview` — the inbox no longer shows `(empty message)`.

`server/src/inbound.ts` records the bounce as an `ops_log` row (`kind: "bounce"`, `ok: false`, `source: "inbound"`) after the inbound message is stored.

Do **not** overwrite `bodyText` on normal mail — only fill the fallback when the parsed body is empty and the message is detected as a bounce.

---

## Compose → Sent

`/mail/send` now returns `{ messageId }` on success. The Worker also persists the sent mail into R2 `sent/{domain}/{id}/` (thin `meta.json` + `raw.eml`) + the `by-message-id` pointer, upserts D1 `mailbox_messages` (`kind=sent`) + `mailbox_fts`, and writes `sent/_sendlog/{id}.json` (operational send history). The client (`useComposeDraftController.ts`) upserts the sent record into the local mailbox store and unions it on refresh.

---

## D1 configured probe

`server/src/lib/d1-status.ts` checks whether each D1 binding is present **and** migrated (expected table exists in `sqlite_master`):

| Binding | Table | Database name |
|---------|-------|---------------|
| `RELAYBASE_LOGS` | `ops_log` | `relaybase-logs` |
| `RELAYBASE_MAIL` | `mailbox_messages` | `relaybase-mail` |

Exposed on:

- `GET /console/connect` (admin token) — desktop Settings + dashboard home connection cards
- `GET /health` — public health (no admin proof)
- `GET /console/ops-logs` — adds `d1Configured: boolean` (logs binding only) for the Log page summary

Connect payload shape:

```json
{
  "d1": {
    "logs": {
      "configured": true,
      "databaseName": "relaybase-logs",
      "binding": "RELAYBASE_LOGS",
      "sizeBytes": 49152
    },
    "mail": {
      "configured": true,
      "databaseName": "relaybase-mail",
      "binding": "RELAYBASE_MAIL",
      "sizeBytes": 37433344
    }
  }
}
```

`sizeBytes` comes from the Cloudflare D1 API (`file_size`) when Worker secrets `CF_ACCOUNT_ID` + `CF_API_TOKEN` are set; otherwise null.

Probe is read-only and soft-fails (returns `false` on D1 errors). `RELAYBASE_MAIL` is **required** for list/search/counts (503 when unbound); the legacy `inboxIndex` key is kept as a deprecated alias of `mail` for older desktop clients.

---

## Dashboard Log page

Nav order in `app/src/console/lib/paths.ts`: … API Keys → **Log** → Settings (icon: `ScrollText`).

Route: `/logs` → `LogsView` (`app/src/console/pages/logs/LogsView.tsx`).

API: `GET /console/ops-logs?limit&status&domain` (`server/src/routes/console/ops-logs.ts`). Client maps `/api/email/logs` → `/console/ops-logs` in `email-api-map.ts`.

UI columns: When · Source · Status · Kind · Subject · Peer · Domain. Filters: all/success/failed + domain search. Summary: total, failed, failed-24h, plus **D1 not configured** when `d1Configured` is false. Selecting a row shows full detail including `error` and `metaJson`.

Dashboard home (`ConnectionStatusCards`) and Settings show a **D1** status card alongside Cloudflare / Worker / R2. Labels: **Configured** (both bindings), **Logs configured** / **Search configured** (one binding), or **Not configured**.

---

## Rules

- **R2 `sent/_sendlog/*` stays authoritative** for Account Logs and the admin server's send-log reads (formerly the legacy `/admin/logs` worker route). Do not point those at D1.
- **D1 `ops_log` is additive.** New event kinds go here; do not duplicate into the send-log store.
- **Customer install ZIP keeps D1 optional.** `server/customer-install/wrangler.toml` has the binding commented out; `recordOpsLog` no-ops when the binding is missing.
- **Soft-fail only.** A D1 write error must never break a send or an inbound store. Helpers catch + `console.error`; routes continue.
- **Bounce detection is best-effort.** Missed bounces are acceptable; false bounce classification of normal mail is not. Only fill fallback `bodyText` when the parsed body is empty.
- **Migrations dir is `server/db/log/migrations/`.** Do not add product-log migrations under `db/app/migrations/` or `db/mail/migrations/`.

---

## Checklist when changing this area

- [ ] `recordOpsLog` still no-ops when `RELAYBASE_LOGS` is undefined (customer install).
- [ ] New event kind added to the `OpsLogKind` union and the `kind` column comment.
- [ ] `/v1/send` and broadcast still write R2 `sent/_sendlog/*` (do not drop the dual-write).
- [ ] Partial-bounce path keeps send-log `ok: true` and D1 `ok: false` (dashboard catches near-failures).
- [ ] Bounce fallback only fills `bodyText` when parsed body is empty — normal mail bodies are untouched.
- [ ] `LogsView` filters and summary still render when `workerConnected` is false.
- [ ] `probeD1Connection` still returns `false` (not throw) when a binding is missing or D1 errors.
- [ ] `/console/connect` and connection-status UI still show D1 as optional (not configured ≠ Worker unhealthy).
- [ ] Migration applied to remote D1 (`wrangler d1 migrations apply relaybase-logs --remote`) and Worker redeployed.
