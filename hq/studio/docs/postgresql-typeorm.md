# hq/studio — PostgreSQL + TypeORM

Branch/worktree: `feat/studio-typeorm` at `.claude/worktrees/feat+studio-typeorm`.

## Setup (Railway)

Studio uses database name **`relaybase`** on your Postgres instance (default Railway DB is usually `railway`).

1. Copy env and fill credentials (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

2. **From your machine:** set `DATABASE_PUBLIC_URL` to the Postgres service’s public TCP URL (Variables → `DATABASE_PUBLIC_URL`, database `railway`). Set `DATABASE_URL` to the same host/port with path `/relaybase` (created in step 3).

3. **On Railway** (studio service in the same project): use private URLs with `postgres.railway.internal` and `DATABASE_ADMIN_URL` … `/railway`, `DATABASE_URL` … `/relaybase`.

4. Install and run full setup (create DB → sync schema → import JSON dev store):

   ```bash
   pnpm install
   # in .env: TYPEORM_SYNC=1
   pnpm run orm:setup
   ```

   Or step by step: `pnpm run orm:ensure-db`, `pnpm run orm:sync`, `pnpm run orm:migrate:json`.

## Setup (local Postgres)

```bash
createdb relaybase
# DATABASE_URL=postgres://localhost:5432/relaybase
TYPEORM_SYNC=1 pnpm run orm:setup
```

## Layout

| Path | Role |
|------|------|
| `src/db/orm/entities/` | TypeORM entity definitions |
| `src/db/orm/data-source.ts` | DataSource factory + singleton init |
| `src/db/orm/migrate-from-json-store.ts` | One-shot JSON → Postgres import |
| `src/db/orm/run-sync-schema.ts` | `synchronize: true` helper (requires `TYPEORM_SYNC=1`) |

API routes still use the JSON file store (`src/db/store.ts`). PostgreSQL is wired for schema + migration; the next step is a repository layer behind `store.read()` / `store.update()`.

## Production

Do **not** use `TYPEORM_SYNC=1` in production. Add TypeORM migrations once the schema stabilizes.
