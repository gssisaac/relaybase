# relaybase-studio

Central Studio backend. Unlike `worker/` (deployed to each customer's Cloudflare account),
this runs as a plain Node server operated by Relaybase — see
[`docs/features/studio-mode-v0.2.md`](../../docs/features/studio-mode-v0.2.md) §1.3.

## Run

Requires PostgreSQL (`DATABASE_URL`). See [docs/postgresql-typeorm.md](./docs/postgresql-typeorm.md).

```bash
cd hq/studio
cp .env.example .env   # set DATABASE_URL, TYPEORM_SYNC=1 for first-time schema
pnpm install
pnpm run orm:setup     # once: create DB + sync schema
pnpm dev
```

Listens on `http://localhost:32832` (override with `PORT`). Port **32831** is used by the desktop app’s CF OAuth loopback — do not run hq/studio on 32831 while Relaybase.app is open.

## Committed assets (not runtime DB)

| Path | Contents |
|------|----------|
| `catalog/templates/*.yaml` | Read-only template gallery blueprints |
| `public/templates/*/meta.yaml` | Built-in HTML layout shells |

Runtime Studio state and auth live in **PostgreSQL** (`hq_auth_users`, store entities). There is no `data/` JSON dev store.

## Studio web auth (`/auth/*`)

The web app proxies `/auth/*` to this service in local dev.

| Route | Purpose |
|-------|---------|
| `POST /auth/signup/cloud` | Internal cloud signup (username, CF account, worker URL, passtoken) |
| `POST /auth/login` | Username + password |
| `POST /auth/refresh` | RTR refresh cookie rotation |
| `POST /auth/logout` | Revoke refresh + clear cookie |
| `GET /auth/me` | Bearer access JWT → user profile |
| `POST /auth/reset-password/oauth` | CF OAuth account match → new password |

Set `HQ_JWT_SECRET` in production. See `.env.example` and `docs/auth/authentication.md`.
