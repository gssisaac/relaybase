# Deploy `hq-relaybase-studio-dbver` (Railway)

## Prerequisites

- Railway project with Postgres (database **`relaybase`** on private URL).
- Service name: **`hq-relaybase-studio-dbver`**
- **Root directory** in Railway: monorepo root (not `hq/studio/`).
- Service settings → **Config file path**: `hq/studio/railway.toml` (absolute from repo root).

## Build

Uses `hq/studio/Dockerfile` (see `hq/studio/railway.toml`).

## Required variables (Railway → Variables)

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://postgres:***@postgres.railway.internal:5432/relaybase` |
| `HQ_JWT_SECRET` | long random string |
| `HQ_AUTH_APP_URL` | `https://hq-relaybase-web-app-dbver.gssisaac.workers.dev` |
| `STUDIO_PUBLIC_BASE_URL` | same as web preview URL |
| `NODE_ENV` | `production` |
| `PORT` | `8080` (Railway sets `PORT`; explicit is fine) |
| `HQ_INTERNAL_AUTH_SECRET` | same value as on **`hq-relaybase-web-app-dbver`** Worker (register-cloud / OAuth reset) |
| `HQ_VAULT_SECRET` | optional; encrypts `passtokenEnc` (defaults to `HQ_JWT_SECRET` if unset) |

Do **not** set `TYPEORM_SYNC=1` in production. After schema changes, run `pnpm run orm:sync` once from a trusted environment against the public DB URL, or apply a migration.

Optional: `STUDIO_API_SECRET` if you lock down `/studio/*` with API key / bearer.

**Web Worker (dbver)** must also set (Wrangler secrets, not committed):

- `HQ_JWT_SECRET` — must match Studio
- `HQ_INTERNAL_AUTH_SECRET` — must match Studio

## Deploy

```bash
pnpm dlx @railway/cli login
cd /path/to/repo/root
railway link   # project + service hq-relaybase-studio-dbver

export DATABASE_URL='postgresql://postgres:PASSWORD@postgres.railway.internal:5432/relaybase'
export HQ_JWT_SECRET='...'
bash hq/studio/scripts/set-railway-dbver-vars.sh

pnpm -C hq/studio run deploy:railway:dbver
```

Or with token:

```bash
export RAILWAY_TOKEN=...
railway up --service hq-relaybase-studio-dbver
```

## Wire Cloudflare web (dbver)

Worker **`hq-relaybase-web-app-dbver`**:

`STUDIO_UPSTREAM_URL` = `https://hq-relaybase-studio-dbver-production.up.railway.app`

Then redeploy web: `pnpm -C app run deploy:web:dbver`
