# D1 migrations and `POST /console/init-db`

**Audience:** humans and coding agents changing D1 schema, install flow, or `wrangler.toml` `migrations_dir` paths.

The **Worker owns D1 schema**. The desktop installer creates empty D1 databases and deploys the Worker; it never runs `wrangler d1 migrations apply` or raw SQL. After deploy, the desktop calls **`POST /console/init-db`** with the admin token. The Worker applies embedded migrations and reports whether tables already existed.

---

## File layout

Each D1 binding has its own migration directory under `server/db/`:

| Binding | Database | SQL directory | Drizzle schema |
|---------|----------|---------------|----------------|
| `RELAYBASE_DB` | `relaybase-db` | `server/db/app/migrations/` | `server/db/app/schema.ts` (drizzle-kit) |
| `RELAYBASE_LOGS` | `relaybase-logs` | `server/db/log/migrations/` | `server/db/log/schema.ts` (reference only) |
| `RELAYBASE_INBOX_INDEX` | `relaybase-inbox-index` | `server/db/inbox-index/migrations/` | `server/db/inbox-index/schema.ts` (reference only) |

Wrangler paths (dogfood + customer-install template):

```toml
migrations_dir = "db/app/migrations"          # RELAYBASE_DB
migrations_dir = "db/log/migrations"        # RELAYBASE_LOGS
migrations_dir = "db/inbox-index/migrations" # RELAYBASE_INBOX_INDEX
```

**Removed (do not recreate):**

- `server/migrations/` — legacy waitlist D1; unbound and deleted.
- `server/migrations-app/`, `server/migrations-logs/`, `server/migrations-inbox/` — moved into `server/db/*/migrations/`.

Embedded migration strings for the Worker live in **`server/db/migrations.ts`**. Keep that file in sync when adding `.sql` files so `POST /console/init-db` and manual `wrangler d1 migrations apply` stay equivalent.

---

## `POST /console/init-db`

Route: `server/src/routes/console/init-db.ts`  
Registered in `server/src/app.ts` as `/console/init-db`.

**Auth:** admin Bearer (`ADMIN_TOKEN` secret or D1 recovery override). Same as `/console/connect`.

**Body:**

```json
{ "clear": false }
```

| `clear` | Behavior |
|---------|----------|
| `false` (default) | Apply only pending migrations (tracked in each D1's `d1_migrations` table). Existing data is kept. |
| `true` | Drop all user tables/indexes/triggers in all three D1 bindings, then re-apply every migration. |

**Response (200):**

```json
{
  "ok": true,
  "alreadyInitialized": true,
  "applied": ["0001_owner_admin_token"],
  "skipped": ["0000_old_pandemic"],
  "cleared": false,
  "results": [
    {
      "target": "app",
      "binding": "RELAYBASE_DB",
      "configured": true,
      "alreadyInitialized": true,
      "applied": [],
      "skipped": ["0000_old_pandemic", "0001_owner_admin_token"]
    }
  ]
}
```

- **`alreadyInitialized`** — at least one probe table existed before this call (`domains`, `ops_log`, or `inbound_search_fts`).
- If `alreadyInitialized` is true and nothing new was applied, the desktop shows **Keep existing data** vs **Clear and reinitialize** (second call with `clear: true`).

Manual curl (after deploy):

```bash
curl -X POST "https://<worker-url>/console/init-db" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Desktop install flow

1. **Probe** (`probe_auto_install`) — list existing Worker / R2 / D1 via Cloudflare API (OAuth install token). Uses script **list**, not GET-by-name (OAuth tokens return 403 on script download).
2. **Confirm** — if resources exist, user picks **Skip** (reuse) or **Reinstall** (delete + recreate) per item. Default: Skip.
3. **Create** — R2 + D1 (wrangler create only; no migrations).
4. **Deploy** — `wrangler deploy`, set `ADMIN_TOKEN` / `CF_ACCOUNT_ID` secrets.
5. **Init DB** — `POST /console/init-db` with `clear: false`.
6. **Connect** — `GET /console/connect`, save credentials.

Rollback deletes Worker + D1 + R2 from the account; it does not call `init-db`.

OAuth install tokens expire (~1 hour). If there is no refresh token, probe/install fails with **Cloudflare authorization expired** — user must **Authorize again** on `/setup/install`.

See also: [cf-oauth-install-token.md](./cf-oauth-install-token.md), [storage-architecture.md](./storage-architecture.md).

---

## Adding a migration

### Product DB (`RELAYBASE_DB`)

1. Change `server/db/app/schema.ts`.
2. Run `pnpm exec drizzle-kit generate --config=drizzle.app.config.ts` → new file under `server/db/app/migrations/`.
3. Copy the new SQL into `server/db/migrations.ts` (`MIGRATIONS` array, `target: "app"`).
4. Deploy Worker; call `POST /console/init-db` (or `wrangler d1 migrations apply relaybase-db --remote` for manual ops).

### Logs or inbox index (hand-written SQL)

1. Add `server/db/log/migrations/000X_….sql` or `server/db/inbox-index/migrations/000X_….sql`.
2. Add the same SQL string to `server/db/migrations.ts` with `target: "logs"` or `"inbox"`.
3. Deploy + `init-db`.

Never mix migration files across databases in one directory — each `migrations_dir` applies to one D1 only.

---

## Related docs

| Topic | Doc |
|-------|-----|
| Product D1 tables | [storage-architecture.md](./storage-architecture.md) |
| Ops log schema | [ops-log-d1.md](./ops-log-d1.md) |
| FTS5 inbox index | [inbound-search-d1-fts5.md](./inbound-search-d1-fts5.md) |
| Customer manual install | [server/customer-install/README.md](../server/customer-install/README.md) |
| OAuth install token | [cf-oauth-install-token.md](./cf-oauth-install-token.md) |
