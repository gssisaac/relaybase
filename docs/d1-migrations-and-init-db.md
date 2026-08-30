# D1 migrations, `POST /console/init-db`, and `POST /console/migrate-db`

**Audience:** humans and coding agents changing D1 schema, install flow, Worker updates, or `wrangler.toml` `migrations_dir` paths.

The **Worker owns D1 schema**. The desktop installer creates empty D1 databases and deploys the Worker; it never runs `wrangler d1 migrations apply` or raw SQL.

| Endpoint | When | Behavior |
|----------|------|----------|
| **`POST /console/init-db`** | Empty D1 only (first install, or after D1s were deleted and recreated) | Apply all pending migrations. If any probe table already exists, **409 `DB_ALREADY_INITIALIZED`** and **no writes**. `clear: true` does **not** drop tables. |
| **`POST /console/migrate-db`** | Existing D1 (install reuse + Settings Worker update) | Apply pending only. Never drops. Reconciles a missing ledger on an existing schema (see **Policy**). |

Auth (any one is enough):

- Owner **console access Bearer** (signed-in Settings → Update Worker)
- **Cloudflare OAuth** — `X-Cf-Access-Token` that can GET this Worker's `CF_ACCOUNT_ID` account (same proof as `POST /console/reset-admin`). Desktop install / upgrade already holds this token; an existing owner must not fail the upgrade.
- **`AUTH_PEPPER` bootstrap** (`X-Auth-Pepper`) — only while no owner exists yet

---

## Policy

The Worker is the only process that applies product SQL. Desktop and Wrangler do not run migrations on customer D1s during install/update.

**Ledger:** each D1 has `d1_migrations` (`name` unique). Names are compared **without** a `.sql` suffix so Wrangler’s `0000_old_pandemic.sql` matches the Worker’s `0000_old_pandemic`.

**Probe tables** (exist ⇒ this D1 already has product schema):

| Target | Binding | Probe table |
|--------|---------|-------------|
| app | `RELAYBASE_DB` | `domains` |
| logs | `RELAYBASE_LOGS` | `ops_log` |
| mail | `RELAYBASE_MAIL` | `mailbox_messages` |

| Situation | `init-db` | `migrate-db` |
|-----------|-----------|--------------|
| Empty D1 (no probe table) | Apply every file, then stamp | Same as apply-pending |
| Probe table exists | **409**, no writes, no DROP | Do **not** re-run the baseline file (the first migration for that target). Stamp it if the ledger missed it, then apply later files that are not in the ledger |
| Statement already applied (`already exists`, `duplicate column`) | Does not run (409 first) | Treat as success, stamp, continue |
| Nothing pending | — | `{ applied: [] }` |

**Do not**

- Use `init-db` `{ clear: true }` to wipe. It does not DROP. Wipe = delete the D1 in Cloudflare, create empty, then `init-db`.
- Re-run `CREATE TABLE domains` (or other baseline SQL) on a live account because `d1_migrations` is empty. That is how `table 'domains' already exists` happens. `migrate-db` stamps the baseline and moves on.
- Treat a migrate-db 500 as “wrong Cloudflare account” or “nothing was uploaded”. The Worker script is already on the account.

**Do**

- Add new schema only as a **new** numbered file + the same string in `server/db/migrations.ts`. Never edit an already-shipped file that live D1s have applied.
- After `server/` changes, rebuild the Worker bundle (`pnpm run build:bundle` for dogfood `wrangler deploy`, or `pnpm pack:worker-install` for the public ZIP). See **AGENTS.md → Worker bundle**.
- Confirm the new isolate with `/health` → `schemaMigrate: "reconcile-v1"`. If that field is missing, the uploaded `worker.js` is still the old migrate-db (it will 500 on `domains already exists`).

---

## File layout

Each D1 binding has its own migration directory under `server/db/`:

| Binding | Database | SQL directory | Drizzle schema |
|---------|----------|---------------|----------------|
| `RELAYBASE_DB` | `relaybase-db` | `server/db/app/migrations/` | `server/db/app/schema.ts` (drizzle-kit) |
| `RELAYBASE_LOGS` | `relaybase-logs` | `server/db/log/migrations/` | `server/db/log/schema.ts` (reference only) |
| `RELAYBASE_MAIL` | `relaybase-mail` | `server/db/mail/migrations/` | `server/db/mail/schema.ts` (reference only) |

Wrangler paths (dogfood + customer-install template):

```toml
migrations_dir = "db/app/migrations"          # RELAYBASE_DB
migrations_dir = "db/log/migrations"           # RELAYBASE_LOGS
migrations_dir = "db/mail/migrations"           # RELAYBASE_MAIL
```

**Removed (do not recreate):**

- `server/migrations/` — legacy waitlist D1; unbound and deleted.
- `server/migrations-app/`, `server/migrations-logs/`, `server/migrations-inbox/` — moved into `server/db/*/migrations/`.
- `server/db/inbox-index/` — replaced by `server/db/mail/` (`RELAYBASE_INBOX_INDEX` → `RELAYBASE_MAIL`). Delete the old `relaybase-inbox-index` D1 after running `POST /console/rebuild-mail` so the account stays at 3 D1s.

Embedded migration strings for the Worker live in **`server/db/migrations.ts`**. Shared apply helper: **`server/src/lib/d1-migrations.ts`**. Keep `migrations.ts` in sync when adding `.sql` files so `init-db` / `migrate-db` and manual `wrangler d1 migrations apply` stay equivalent.

**Rebuild after `server/` changes.** Desktop update uploads the hosted install ZIP, not live TypeScript and not a local overlay. `pnpm pack:worker-install` then deploy `kembo/website`. Until that runs, `/console/migrate-db` 404s on the old script. See **AGENTS.md → Worker bundle**.

---

## `POST /console/init-db`

Route: `server/src/routes/console/init-db.ts`  
Registered in `server/src/app.ts` as `/console/init-db`.

**Empty D1 only.** Before any CREATE/DROP/INSERT, the Worker probes `domains` / `ops_log` / `mailbox_messages`. If any exists:

```json
{ "ok": false, "error": "DB_ALREADY_INITIALIZED", "alreadyInitialized": true }
```

HTTP 409. Existing data is untouched. To apply pending schema on that database, use **`migrate-db`**. To start empty, delete the D1s in the Cloudflare dashboard (or Setup Reinstall), create new empty databases, then call `init-db` again.

Body is ignored for wipe. `{ "clear": true }` does **not** drop tables.

Manual curl (empty D1 after deploy):

```bash
curl -X POST "https://<worker-url>/console/init-db" \
  -H "X-Auth-Pepper: <AUTH_PEPPER>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

> After an owner is configured, use `Authorization: Bearer <owner access token>` or `X-Cf-Access-Token: <Cloudflare OAuth access token>` instead of `X-Auth-Pepper`.

---

## `POST /console/migrate-db`

Route: `server/src/routes/console/migrate-db.ts`  
Registered in `server/src/app.ts` as `/console/migrate-db`.

Applies only migrations not yet in each D1's `d1_migrations` table (names normalized, no `.sql`). No `clear` field. If the probe table exists but the baseline file is missing from the ledger, that file is **stamped, not re-executed**. Statements that fail with `already exists` / `duplicate column` are treated as already applied. If nothing is pending, `applied` is `[]`.

```bash
curl -X POST "https://<worker-url>/console/migrate-db" \
  -H "Authorization: Bearer <owner access token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

> On first install (no owner yet), use `X-Auth-Pepper: <AUTH_PEPPER>`. Desktop OAuth upgrade sends `X-Cf-Access-Token` even when an owner already exists.

Desktop: `desktopMigrateWorkerDb` / `migrate_worker_db_cmd`. After Worker deploy, the installer waits for `/health`, then retries migrate-db on transient 401 / 1104 / 404 (secret not on the isolate yet).

---

## Desktop install flow

1. **Probe** (`probe_auto_install`) — list existing Worker / R2 / D1 via Cloudflare API (OAuth install token). Uses script **list**, not GET-by-name (OAuth tokens return 403 on script download).
2. **Confirm** — if resources exist, user picks **Skip** (reuse) or **Reinstall** (delete + recreate) per item. Default: Skip. Reinstall of D1 is how you wipe — not `init-db` `clear`.
3. **Create** — R2 + D1 via Cloudflare HTTP API (no migrations). Skip reuses existing IDs.
4. **Deploy** — PUT `worker.js` with bindings, set `AUTH_PEPPER` / `CF_ACCOUNT_ID` secrets, enable workers.dev.
5. **Schema** — empty D1s (just created): `POST /console/init-db`. Reused D1s: `POST /console/migrate-db`. Auth is pepper (no owner), owner Bearer, or Cloudflare OAuth (`X-Cf-Access-Token`).
6. **Owner setup** — `POST /console/setup-admin` (issued passtoken, shown once + downloaded + written to OS keyring `owner-passtoken`), then `POST /console/login` → owner access + refresh.
7. **Connect** — `GET /console/connect`, save non-secret connection info.

Rollback deletes Worker + D1 + R2 from the account; it does not call `init-db`.

---

## Settings → Worker update

UI reuses Setup method + progress modules (`purpose: "worker-update"`):

1. **Settings → Worker** — Check for updates. **Update Worker** goes to `/settings/worker/update`.
2. **`/settings/worker/update`** — Recommended (OAuth) or Manual + CLI. After OAuth, confirm the account’s Worker URL matches the saved URL. Wrong Cloudflare account → stop, no upload.
3. **Progress** — same URL check again, then upload Worker script only (existing R2/D1 lookup). Then **`migrate-db`**, never `init-db`. Pending Verify retries migrate-db + connect. No Keep/Clear, no R2/D1 rollback.

OAuth install tokens expire (~1 hour). Authorize again on `/setup/install` or `/settings/worker/update`.

See also: [cf-oauth-install-token.md](./cf-oauth-install-token.md), [storage-architecture.md](./storage-architecture.md).

---

## Adding a migration

### Product DB (`RELAYBASE_DB`)

1. Change `server/db/app/schema.ts`.
2. Run `pnpm exec drizzle-kit generate --config=drizzle.app.config.ts` → new file under `server/db/app/migrations/`.
3. Copy the new SQL into `server/db/migrations.ts` (`MIGRATIONS` array, `target: "app"`).
4. Deploy Worker; call **`POST /console/migrate-db`** on existing installs (or `init-db` only on empty D1). Do not rewrite `0000_old_pandemic` — existing D1s already have that schema.

### Logs or mail index (hand-written SQL)

1. Add `server/db/log/migrations/000X_….sql` or `server/db/mail/migrations/000X_….sql`.
2. Add the same SQL string to `server/db/migrations.ts` with `target: "logs"` or `"mail"`.
3. Deploy + `migrate-db` (existing) or `init-db` (empty).

Never mix migration files across databases in one directory — each `migrations_dir` applies to one D1 only.

---

## Related docs

| Topic | Doc |
|-------|-----|
| Product D1 tables | [storage-architecture.md](./storage-architecture.md) |
| Ops log schema | [ops-log-d1.md](./ops-log-d1.md) |
| Mail index (list/search/counts) | [mailbox-d1.md](./mailbox-d1.md) |
| Customer manual install | [server/customer-install/README.md](../server/customer-install/README.md) |
| OAuth install token | [cf-oauth-install-token.md](./cf-oauth-install-token.md) |
