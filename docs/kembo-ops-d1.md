# Kembo ops (D1) — console + admin

**Audience:** humans and coding agents changing `kembo/console`, `kembo/admin`, license/account/waitlist/billing storage, or the operator settings store.

**Primary code:**

| Area | Paths |
|------|------|
| D1 binding | `kembo/console/wrangler.jsonc` and `kembo/admin/wrangler.jsonc` → `DB` / database `kembo-ops` |
| Drizzle schema (all 6 tables) | `kembo/console/src/db/schema.ts` |
| Drizzle schema (admin subset) | `kembo/admin/src/db/schema.ts` (`product_settings` only) |
| Clients | `kembo/console/src/db/client.ts`, `kembo/admin/src/db/client.ts` |
| Kit config + SQL | `kembo/console/drizzle.config.ts`, `kembo/console/migrations/` |
| Accounts / recovery / sessions | `kembo/console/src/lib/accounts.ts` |
| Licenses | `kembo/console/src/lib/licenses.ts` |
| License admin gate | `kembo/console/src/lib/license-admin.ts` |
| Operator settings | `kembo/admin/src/lib/config/product-store.ts`, `kembo/admin/src/relaybase/lib/settings.ts` |
| KV → D1 one-shot | `kembo/console/scripts/migrate-kv-to-d1.mjs` |

Read this before adding a console/admin durable field, touching license keys, or reintroducing `KEMBO_OPS` / `KEMBO_LICENSES` / `KEMBO_ACCOUNTS` bindings.

---

## Why one D1

Kembo used to split state across two KV namespaces and one D1:

| Legacy store | Keys / tables | Replaced by |
|--------------|---------------|-------------|
| KV `KEMBO_OPS` | `product:{serviceId}:{filename}` (operator settings JSON) | `product_settings` |
| KV `KEMBO_LICENSES` | 4 keys per license (`srv:license:id:`, `:key:`, `:email:`, `:customer:`) | `licenses` |
| D1 `kembo-accounts` | `waitlist`, `accounts`, `account_workers`, `account_recovery` | same table names in `kembo-ops` |
| KV `RELAYBASE_APP_DOGFOOD` | leftover dogfood userdata | **dropped** — filesystem fallback only in admin |

Admin (`admin.relaybase.xyz`) and console (`console.relaybase.xyz`) now share one D1 `kembo-ops` (binding `DB`) on the Kembo Cloudflare account. Drizzle is the schema source of truth. Do **not** re-add those KV/D1 bindings.

Product Worker catalog state is a different database (`RELAYBASE_DB` on the customer Worker). Do not put mailbox/audience/broadcasts here.

---

## Schema (6 tables)

Generated SQL: `kembo/console/migrations/0000_secret_wong.sql`.

### `waitlist`

Public marketing signup (`POST /api/v1/waitlist`). Unique `email`. `source` + `user_agent` are optional.

### `accounts`

Console login. `password_hash` is the only secret stored here. Sessions are signed cookies (`CONSOLE_SESSION_SECRET`), not rows.

### `account_workers`

`(account_id, worker_url)` — which customer `*.workers.dev` URLs belong to a console account. Used for ADMIN_TOKEN recovery.

### `account_recovery`

One-time token hashes for password reset and `admin_token` recovery. Tokens themselves are never stored.

### `product_settings`

Replaces `KEMBO_OPS`. Composite PK `(service_id, filename)`. Current row:

| service_id | filename | `data` JSON |
|------------|----------|-------------|
| `relaybase` | `settings.json` | `{ workerUrl, adminToken }` only |

`adminToken` must match the product Worker's `ADMIN_TOKEN` secret. It also authorizes admin → console license proxy (`kembo/admin/src/app/api/licenses/route.ts` sends it as `Authorization: Bearer`, compared to console secret `RELAYBASE_ADMIN_TOKEN`).

**Never** store Cloudflare credentials, end-user `rb-auth-…` tokens, or plaintext API keys here.

### `licenses`

One row per Mac license. KV's four duplicate keys collapse to unique `key_hash` plus indexes on `email` and `stripe_customer_id`. `active` is `0|1`. Status: `active` | `past_due` | `canceled` | `revoked`.

---

## HTTP surface

Console Next routes live under `/api/v1/…`. `next.config.ts` rewrites `/v1/:path*` → `/api/v1/:path*` so the desktop and admin can keep calling `https://console.relaybase.xyz/v1/…`.

| Route | Auth | Store |
|-------|------|-------|
| `POST /api/v1/waitlist` | CORS allowlist (website) | `waitlist` |
| `/api/v1/account?action=…` | public signup/login/recover; session for worker register + recovery-token | `accounts`, `account_workers`, `account_recovery` |
| `POST /api/v1/recovery/verify-admin-token` | public, token-bound | `account_recovery` + `account_workers` |
| `GET/POST /api/v1/license/admin` | session **or** `RELAYBASE_ADMIN_TOKEN` bearer | `licenses` |
| `DELETE /api/v1/license/admin/[id]` | same | `licenses` |
| `POST /api/v1/license/verify` | public (desktop activate) | `licenses` |
| `/api/v1/billing/*` | session / Stripe signature | `accounts` + `licenses` |

Admin Licenses page fetches `/api/licenses`, which proxies to `console.relaybase.xyz/v1/license/admin`. Nested App Router files are required — a single `license/route.ts` does **not** match `/license/admin`.

Do not put `export const runtime = "edge"` on these OpenNext routes. Edge chunks are not bundled into the Worker and the handlers 500.

`getEnv()` must use `getCloudflareContext({ async: true })` from `@opennextjs/cloudflare` (not `require` + `getRequestContext`).

---

## Migrations

```bash
cd kembo/console
npx drizzle-kit generate
# Apply to remote kembo-ops (new account):
CLOUDFLARE_ACCOUNT_ID=<kembo-account> wrangler d1 migrations apply kembo-ops --remote
# Or execute the generated SQL:
CLOUDFLARE_ACCOUNT_ID=<kembo-account> wrangler d1 execute kembo-ops --remote --file migrations/0000_secret_wong.sql
```

One-shot KV copy from the old account (does not delete source):

```bash
CLOUDFLARE_API_TOKEN=… node kembo/console/scripts/migrate-kv-to-d1.mjs
```

Old-account `kembo-accounts` / `KEMBO_OPS` / `KEMBO_LICENSES` are left in place for rollback.

---

## Forbidden

- Re-binding `KEMBO_OPS`, `KEMBO_LICENSES`, `KEMBO_ACCOUNTS`, or `RELAYBASE_APP_DOGFOOD` on `kembo-admin` / `kembo-console`
- Dual-write to those KV namespaces
- Putting product mailbox/audience/broadcast catalog in `kembo-ops` — that is `RELAYBASE_DB` on the customer Worker
- Storing CF API tokens or plaintext API keys in `product_settings`
- License/account/billing routes on the product Worker
