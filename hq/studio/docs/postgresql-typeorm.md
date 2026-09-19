# hq/studio — PostgreSQL + TypeORM

Studio **requires** `DATABASE_URL`. There is no JSON/YAML file store fallback.

## Setup (Railway)

Studio uses database name **`relaybase`** on your Postgres instance (default Railway DB is usually `railway`).

1. Copy env and fill credentials (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

2. **From your machine:** set `DATABASE_PUBLIC_URL` to the Postgres service’s public TCP URL (Variables → `DATABASE_PUBLIC_URL`, database `railway`). Set `DATABASE_URL` to the same host/port with path `/relaybase` (created in step 3).

3. **On Railway** (studio service in the same project): use private URLs with `postgres.railway.internal` and `DATABASE_ADMIN_URL` … `/railway`, `DATABASE_URL` … `/relaybase`.

4. Install and sync schema:

   ```bash
   pnpm install
   # in .env: TYPEORM_SYNC=1
   pnpm run orm:setup
   ```

   Or step by step: `pnpm run orm:ensure-db`, `pnpm run orm:sync`.

## Setup (local Postgres)

```bash
createdb relaybase
# DATABASE_URL=postgres://localhost:5432/relaybase
TYPEORM_SYNC=1 pnpm run orm:setup
```

## Imports

`tsconfig.json` path aliases: `@db/*`, `@lib/*`, `@services/*`, `@/*` (under `src/`). Production build runs `tsc-alias` so `dist/` keeps resolvable relative paths.

## Layout

| Path | Role |
|------|------|
| `src/db/types.ts`, `src/db/auth-types.ts` | Store document + auth record types |
| `src/db/entities/` | TypeORM entity definitions |
| `src/lib/` | Infra only: `auth/`, `db/`, `orm/`, `mail/`, `render/`, `shared/`, `vault/`, `webhooks/` |
| `src/lib/orm/data-source.ts` | DataSource factory + singleton init |
| `src/services/repositories.ts` | Typed TypeORM repository accessors |
| `src/services/index.ts` | Domain singleton exports (`templateService`, `newsletterService`, …) |
| `src/services/{template,message,newsletter,trigger,subscriber,account,tracking,analytics,asset,job}/` | Domain modules + `service.ts` singleton |
| `src/services/studio/` | Document bootstrap, reconcile, persist |
| `src/services/auth/` | Auth repository; `auth-service.ts` at services root |

**Auth:** per-row TypeORM saves; no full-table TRUNCATE on token refresh.

**Studio:** `readStudioDocument()` / `mutateStudioDocument()` replace the removed `studioService`. Prefer domain services for new code; mutators persist with entity upsert only.

### Auth schema (`hq_auth_users`)

Cloud-unified auth fields (see `docs/auth/authentication.md`):

| Column | Purpose |
|--------|---------|
| `username` | Unique cloud login id |
| `cf_account_id` | Cloudflare account for OAuth password reset |
| `worker_url` | Customer Worker base URL |
| `passtoken_enc` | AES-256-GCM vault blob (never exposed to browsers) |

## Production

Do **not** use `TYPEORM_SYNC=1` in production. Add TypeORM migrations once the schema stabilizes.

Deploy: [deploy-railway.md](./deploy-railway.md) (Node server on Railway, not Cloudflare Workers).
