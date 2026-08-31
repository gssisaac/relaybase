# HQ ops (D1) — console + admin

**Audience:** humans and coding agents changing `hq/console`, `hq/admin`, license/account/waitlist/billing storage, or the operator settings store.

**Primary code:**

| Area | Paths |
|------|------|
| D1 binding | `hq/console/wrangler.jsonc`, `hq/admin/wrangler.jsonc`, and `hq/website/wrangler.jsonc` → `DB` / database `strum-relaybase-ops` |
| Drizzle schema (all 7 tables) | `hq/console/src/db/schema.ts` |
| Drizzle schema (admin subset) | `hq/admin/src/db/schema.ts` (`product_settings` + `beta_invites` + `licenses`) |
| Clients | `hq/console/src/db/client.ts`, `hq/admin/src/db/client.ts` |
| Kit config + SQL | `hq/console/drizzle.config.ts`, `hq/console/migrations/` |
| Accounts / recovery / sessions | `hq/console/src/lib/accounts.ts` |
| Licenses | `hq/console/src/lib/licenses.ts` (verify + Stripe); `hq/admin/src/lib/licenses.ts` (list / issue / revoke) |
| License admin gate | `hq/console/src/lib/license-admin.ts` (console `/v1/license/admin` only) |
| Operator settings | `hq/admin/src/lib/config/product-store.ts`, `hq/admin/src/relaybase/lib/settings.ts` |

Read this before adding a console/admin durable field or touching license keys.

---

## Why one D1

Admin (`admin.relaybase.xyz`), console (`console.relaybase.xyz`), and the marketing site share one D1 `strum-relaybase-ops` (binding `DB`) on the Strum Cloudflare account (`3adf03d991843094a7343eebc0a98007`). Workers: `strum-relaybase-admin`, `strum-relaybase-console`, `strum-relaybase-website`. Drizzle is the schema source of truth.

Product Worker catalog state is a different database (`RELAYBASE_DB` on the customer Worker). Do not put mailbox/audience/broadcasts here.

---

## Schema (7 tables)

Generated SQL: `hq/console/migrations/0000_secret_wong.sql` (initial) and `hq/console/migrations/0001_bizarre_smasher.sql` (`beta_invites`).

### `waitlist`

Public marketing signup (`POST /api/v1/waitlist`). Unique `email`. `source` + `user_agent` are optional.

### `beta_invites`

Public marketing beta signup (`POST /api/beta` on `strum-relaybase-website`). PK `uuid` is the download token at `relaybase.xyz/downloads/{uuid}`. Unique `email` reuses the same invite. `data` is the invite JSON as one blob: `email`, `createdAt`, `locale` (country/city/region/timezone), `browser`, `os`, `userAgent`, `downloads` (`{ at }` timestamps). Website Worker uses raw SQL; do not add a second schema copy.

The website no longer calls `POST /api/v1/waitlist`. The `waitlist` table stays for existing rows.

### `accounts`

Console login. `password_hash` is the only secret stored here. Sessions are signed cookies (`CONSOLE_SESSION_SECRET`), not rows.

### `account_workers`

`(account_id, worker_url)` — which customer `*.workers.dev` URLs belong to a console account. Used for ADMIN_TOKEN recovery.

### `account_recovery`

One-time token hashes for password reset and `admin_token` recovery. Tokens themselves are never stored.

### `product_settings`

Composite PK `(service_id, filename)`. Current row:

| service_id | filename | `data` JSON |
|------------|----------|-------------|
| `relaybase` | `settings.json` | `{ workerUrl, adminToken }` only |

`adminToken` must match the product Worker's `ADMIN_TOKEN` secret. It authorizes admin → product Worker calls (`/console/*`, `/mail/send`). It does **not** authorize license admin — admin reads `licenses` from D1 directly.

**Never** store Cloudflare credentials, end-user `rb-auth-…` tokens, or plaintext API keys here.

### `licenses`

One row per Mac license. Unique `key_hash` plus indexes on `email` and `stripe_customer_id`. `active` is `0|1`. Status: `active` | `past_due` | `canceled` | `revoked`.

---

## HTTP surface

Console Next routes live under `/api/v1/…`. `next.config.ts` rewrites `/v1/:path*` → `/api/v1/:path*` so the desktop can keep calling `https://console.relaybase.xyz/v1/…`.

| Route | Auth | Store |
|-------|------|-------|
| `POST /api/v1/waitlist` | CORS allowlist (legacy) | `waitlist` |
| `POST /api/beta` on `relaybase.xyz` | public (website Worker) | `beta_invites` |
| `GET /api/beta` on `admin.relaybase.xyz` | admin (direct D1 read) | `beta_invites` |
| `GET /downloads/:uuid` on `relaybase.xyz` | public; 404 if unknown uuid | `beta_invites` |
| `/api/v1/account?action=…` | public signup/login/recover; session for worker register + recovery-token | `accounts`, `account_workers`, `account_recovery` |
| `POST /api/v1/recovery/verify-admin-token` | public, token-bound | `account_recovery` + `account_workers` |
| `GET/POST /api/v1/license/admin` | session **or** `RELAYBASE_ADMIN_TOKEN` bearer | `licenses` |
| `DELETE /api/v1/license/admin/[id]` | same | `licenses` |
| `POST /api/v1/license/verify` | public (desktop activate) | `licenses` |
| `/api/v1/billing/*` | session / Stripe signature | `accounts` + `licenses` |
| `GET/POST/DELETE /api/licenses` on `admin.relaybase.xyz` | admin (direct D1) | `licenses` |

Admin Licenses page fetches `/api/licenses`, which queries `strum-relaybase-ops.licenses` directly (no console hop). Desktop activate still uses `POST /v1/license/verify` on console. Nested App Router files are required for console `/v1/license/admin` — a single `license/route.ts` does **not** match `/license/admin`.

Admin Beta page fetches `/api/beta`, which queries `strum-relaybase-ops.beta_invites` directly (no console hop). Invite-email status is joined from the product Worker send logs (`/api/relaybase/logs`, `from: beta@relaybase.xyz`).

Do not put `export const runtime = "edge"` on these OpenNext routes. Edge chunks are not bundled into the Worker and the handlers 500.

`getEnv()` must use `getCloudflareContext({ async: true })` from `@opennextjs/cloudflare` (not `require` + `getRequestContext`).

---

## Migrations

```bash
cd hq/console
npx drizzle-kit generate
# Apply to remote strum-relaybase-ops:
CLOUDFLARE_ACCOUNT_ID=3adf03d991843094a7343eebc0a98007 wrangler d1 migrations apply strum-relaybase-ops --remote
# Or execute the generated SQL:
CLOUDFLARE_ACCOUNT_ID=3adf03d991843094a7343eebc0a98007 wrangler d1 execute strum-relaybase-ops --remote --file migrations/0000_secret_wong.sql
```

---

## Forbidden

- Reintroducing Cloudflare KV — HQ ops is D1 `strum-relaybase-ops` only
- Putting product mailbox/audience/broadcast catalog in `strum-relaybase-ops` — that is `RELAYBASE_DB` on the customer Worker
- Storing CF API tokens or plaintext API keys in `product_settings`
- License/account/billing routes on the product Worker
