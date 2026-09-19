# Deploy `hq-relaybase-studio` (Railway)

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
| `HQ_AUTH_APP_URL` | `https://relaybase.email` |
| `STUDIO_PUBLIC_BASE_URL` | `https://studio-api.relaybase.email` or your public Studio URL |
| `NODE_ENV` | `production` |
| `PORT` | `8080` (Railway sets `PORT`; explicit is fine) |
| `HQ_INTERNAL_AUTH_SECRET` | same value as on **`hq-relaybase-web-app`** Worker |
| `HQ_VAULT_SECRET` | optional; encrypts `passtokenEnc` |

Do **not** set `TYPEORM_SYNC=1` in production.

**Web Worker (`hq-relaybase-web-app`)** Wrangler vars/secrets:

- `STUDIO_UPSTREAM_URL` → Railway public URL for this service
- `HQ_JWT_SECRET` — must match Studio
- `HQ_INTERNAL_AUTH_SECRET` — must match Studio

## Deploy

```bash
pnpm dlx @railway/cli login
cd /path/to/repo/root
railway link   # project + service hq-relaybase-studio-dbver

pnpm -C hq/studio run deploy:railway
```

## Wire Cloudflare web

Worker **`hq-relaybase-web-app`** (`wrangler.web.jsonc`):

`STUDIO_UPSTREAM_URL` = your Railway `hq-relaybase-studio` public URL

Then redeploy web: `pnpm -C app run deploy:web`
