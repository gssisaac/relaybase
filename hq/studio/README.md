# relaybase-studio

Central Studio backend. Unlike `worker/` (deployed to each customer's Cloudflare account),
this runs as a plain Node server operated by Relaybase — see
[`docs/features/studio-mode-v0.2.md`](../../docs/features/studio-mode-v0.2.md) §1.3.

## Run

```bash
cd hq/studio
pnpm install
pnpm dev
```

Listens on `http://localhost:32831` (override with `PORT`).

## Dev data

| Path | Contents |
|------|----------|
| `data/store.json` | Account, layouts, newsletters, triggers, audience, assets metadata |
| `data/templates/*.yaml` | Message templates (preset + user); loaded dynamically at runtime |

Override directories with `STUDIO_DATA_DIR` and `STUDIO_TEMPLATES_DIR`.

Legacy `templates[]` inside `store.json` is imported once on startup, written to YAML, then removed from the JSON file.

## HQ Cloud auth (`/auth/*`)

User records live in `data/auth.json` (same directory as `store.json`). The web app
proxies `/auth/*` to this service in local dev.

| Route | Purpose |
|-------|---------|
| `POST /auth/signup` | 2-step signup payload: Worker proof + name + email + password (+ confirm) → links `store.json` worker URL |
| `POST /auth/login` | Same |
| `POST /auth/refresh` | RTR refresh cookie rotation |
| `POST /auth/logout` | Revoke refresh + clear cookie |
| `GET /auth/me` | Bearer access JWT → user profile |
| `POST /auth/forgot-password` | Email reset token (dev: link logged to console) |
| `POST /auth/reset-password` | Token + new password → new session |

Set `HQ_JWT_SECRET` in production. See `.env.example` and `docs/auth/authentication.md`.
