# Ops Log (D1) & Dashboard Log page

**Audience:** humans and coding agents changing send/bounce logging, the Dashboard Log page, or D1 `RELAYBASE_LOGS`.

**Primary code:**

| Area | Paths |
|------|------|
| D1 binding + migration | `server/wrangler.toml` (`RELAYBASE_LOGS`), `server/migrations-logs/0001_ops_logs.sql` |
| Env type | `server/src/env.ts` (`RELAYBASE_LOGS?: D1Database`) |
| Log helper | `server/src/lib/ops-logs.ts` (`recordOpsLog`, `listOpsLogs`) |
| Bounce detection | `server/src/lib/bounce-detect.ts` |
| Compose send (writes log + returns Sent) | `server/src/routes/admin-send.ts` |
| API send (dual-write KV + D1) | `server/src/routes/send.ts` |
| Broadcast send (dual-write KV + D1) | `server/src/lib/catalog-broadcasts.ts` |
| Inbound bounce logging | `server/src/inbound.ts`, `server/src/lib/inbound-store.ts` |
| Logs API | `server/src/routes/admin-ops-logs.ts` → `/admin/ops-logs` |
| Client mapping | `app/src/lib/desktop/email-api-map.ts` (`/api/email/logs` → `/admin/ops-logs`) |
| Dashboard nav | `app/src/dashboard/paths.ts` (Log tab after API Keys) |
| Dashboard route | `app/src/dashboard/panel.tsx` (`case "logs"`) |
| Log page UI | `app/src/dashboard/components/LogsView.tsx` |

Read this before changing send/bounce logging, adding a Log page event kind, or touching `ops_log` schema.

---

## Why a second log store

Relaybase already had KV `srv:sendlog:*` (`server/src/lib/send-logs.ts`) for send history. That store is **authoritative** for Account Logs (`/admin/stats/account-logs`) and the legacy `/admin/logs` route. Do **not** remove or rewrite KV send logs.

Two gaps motivated D1 `RELAYBASE_LOGS`:

1. **Compose (`/admin/send`) was invisible.** Desktop compose never wrote any log, so a failed forward showed up only as a toast — nothing in the dashboard.
2. **Async bounces were invisible.** CF Email Sending returns a bounce DSN later as inbound mail. Without parsing it, the inbox shows `(empty message)` and no failure is recorded anywhere.

D1 `ops_log` is an **additional** event log that covers compose, API, broadcast, and inbound bounce events in one queryable table. KV send logs stay untouched.

---

## Schema

`server/migrations-logs/0001_ops_logs.sql`:

```sql
CREATE TABLE IF NOT EXISTS ops_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,          -- send | bounce | api_error
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

Migrations live in `server/migrations-logs/` (separate from `server/migrations/` used by `RELAYBASE_WAITLIST`) so the two D1 databases never collide.

---

## Events recorded

| Source | Route | Kinds | Notes |
|--------|-------|-------|-------|
| Compose | `POST /admin/send` | `send`, `api_error` | Validation errors, all-bounce, CF exception, success, partial bounce. Also returns a `sent` object so the client upserts Sent. |
| API | `POST /v1/send` | `send`, `api_error` | Dual-write: KV `srv:sendlog:*` (unchanged) + D1 `ops_log`. Partial bounce keeps KV `ok: true` but D1 `ok: false` so the dashboard catches it. |
| Broadcast | `catalog-broadcasts.ts` | `send` | Dual-write per recipient (KV + D1). |
| Inbound | `server/src/inbound.ts` | `bounce` | Detected via `bounce-detect.ts`; logged with `Final-Recipient`, `Diagnostic-Code`, `Status` when present. |

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

`/admin/send` now returns `{ messageId, sent }` on success, where `sent` is a `SentEmail`-shaped object (`app/src/email/components/types.ts`). The client (`useComposeDraftController.ts`) already upserts `sent` into the mailbox store and unions it on refresh — no client change was needed.

Server-side Sent storage (replacing `empty-sent`) is **out of scope** for this pass. The local `~/.relaybase/.../sent.json` upsert is the only Sent source for compose; remote KV Sent remains untouched.

---

## Dashboard Log page

Nav order in `app/src/dashboard/paths.ts`: … API Keys → **Log** → Settings (icon: `ScrollText`).

Route: `/logs` → `LogsView` (`app/src/dashboard/components/LogsView.tsx`).

API: `GET /admin/ops-logs?limit&status&domain` (`server/src/routes/admin-ops-logs.ts`). Client maps `/api/email/logs` → `/admin/ops-logs` in `email-api-map.ts`.

UI columns: When · Source · Status · Kind · Subject · Peer · Domain. Filters: all/success/failed + domain search. Summary: total, failed, failed-24h. Selecting a row shows full detail including `error` and `metaJson`.

---

## Rules

- **KV `srv:sendlog:*` stays authoritative** for Account Logs and legacy `/admin/logs`. Do not point those routes at D1.
- **D1 `ops_log` is additive.** New event kinds go here; do not duplicate into KV.
- **Customer install ZIP keeps D1 optional.** `server/customer-install/wrangler.toml` has the binding commented out; `recordOpsLog` no-ops when the binding is missing.
- **Soft-fail only.** A D1 write error must never break a send or an inbound store. Helpers catch + `console.error`; routes continue.
- **Bounce detection is best-effort.** Missed bounces are acceptable; false bounce classification of normal mail is not. Only fill fallback `bodyText` when the parsed body is empty.
- **Migrations dir is `migrations-logs/`.** Do not add product-log migrations under `server/migrations/` (that dir belongs to `RELAYBASE_WAITLIST`).

---

## Checklist when changing this area

- [ ] `recordOpsLog` still no-ops when `RELAYBASE_LOGS` is undefined (customer install).
- [ ] New event kind added to the `OpsLogKind` union and the `kind` column comment.
- [ ] `/v1/send` and broadcast still write KV `srv:sendlog:*` (do not drop the dual-write).
- [ ] Partial-bounce path keeps KV `ok: true` and D1 `ok: false` (dashboard catches near-failures).
- [ ] Bounce fallback only fills `bodyText` when parsed body is empty — normal mail bodies are untouched.
- [ ] `LogsView` filters and summary still render when `workerConnected` is false.
- [ ] Migration applied to remote D1 (`wrangler d1 migrations apply relaybase-logs --remote`) and Worker redeployed.
