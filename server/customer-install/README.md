# Relaybase Worker — install into your Cloudflare account

This package deploys the Relaybase routing Worker into **your** Cloudflare account. It is the same Worker code Relaybase runs for its own dogfood install; it only serves product routes (`/mail/*`, `/console/*`, `/mobile/*`, `/v1/*`). Account, billing, license, and recovery live in the separate `console.relaybase.xyz` Next.js app.

## Two ways to install

1. **Auto-install (recommended)** — from the Relaybase desktop app: paste a Cloudflare API token and the desktop runs Wrangler for you, streaming each step to an install log. Your API token stays on your Mac and is never sent to Relaybase.
2. **Manual install (this README)** — for advanced users or headless machines: run Wrangler yourself, then paste the Worker URL + admin token into the app.

> Cloudflare may bill a small Workers Paid plan fee (≈$5/mo) directly to you. Relaybase Pro is a separate, one-time software license.

## Prerequisites (manual install)

- A Cloudflare account
- Node.js 20+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npx wrangler` is enough)

## 1. Create storage (exact names)

```bash
npx wrangler r2 bucket create relaybase-mailbox
npx wrangler d1 create relaybase-logs
npx wrangler d1 create relaybase-inbox-index
npx wrangler d1 create relaybase-db
```

Copy each D1 **id** into `wrangler.toml` (replace the `REPLACE_WITH_*` placeholders). Do **not** create a KV namespace — product state is D1 + R2, and the admin token is the `ADMIN_TOKEN` Worker secret.

## 2. Set admin secret

```bash
npx wrangler secret put ADMIN_TOKEN
```

Choose a long random value (e.g. `openssl rand -hex 24`). **Save it** — you will paste the same value into the Relaybase desktop app. If you lose it later, you can reset it from the desktop app (Settings → Reset admin token) using a one-time recovery token issued by `console.relaybase.xyz`; no Wrangler required.

Optional — `CF_ACCOUNT_ID` is set by desktop auto-install. For domain / inbox routing / DNS from the Worker, add `CF_API_TOKEN` as a **Secret** in the dashboard (Worker → Settings → Runtime variables and secrets) or:

```bash
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_API_TOKEN
```

The token needs Account → Email Sending → Edit, Zone → Email Routing Rules → Edit, and Zone → Zone → Read. Sending uses the `[[send_email]]` `EMAIL` binding in `wrangler.toml`, not this token.

## 3. Deploy

```bash
npx wrangler deploy
```

Wrangler prints a URL like `https://relaybase-api.<your-subdomain>.workers.dev`.

## 4. Initialize D1 schema

The Worker owns its own schema. After deploy, call the init endpoint with
your admin token to create tables:

```bash
curl -X POST https://relaybase-api.<your-subdomain>.workers.dev/console/init-db \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

If the databases already have tables from a previous install, the response
includes `alreadyInitialized: true`. To clear all data and reinitialize:

```bash
curl -X POST https://relaybase-api.<your-subdomain>.workers.dev/console/init-db \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"clear": true}'
```

For manual installs you can also use `wrangler d1 migrations apply` directly,
but the init endpoint is the recommended path — it is what the desktop
auto-installer uses.

## 5. Connect the desktop app

1. Open Relaybase → **Install routing Worker**
2. Paste the Worker URL and the same `ADMIN_TOKEN`
3. Tap **Verify & continue**

The app calls `GET /console/connect` on your Worker with that token. No Cloudflare Account API token is sent to Relaybase.

## Worker endpoints this package exposes

- `GET /health` — liveness + R2 binding check (public)
- `GET /console/connect` — desktop self-install probe (admin Bearer)
- `POST /console/init-db` — initialize D1 schema (admin Bearer); `{ clear: true }` to drop and reapply
- `/console/*` — management (admin Bearer): mailbox, domains, addresses, keys, audience, broadcasts, stats, ops-logs, `register-owner`, `recover-admin`
- `/mail/*` — desktop mail operations (admin Bearer)
- `/mobile/*` — Flutter companion + desktop team-user login (per-account mobile password)
- `/v1/*` — domain-scoped send/inbox/webhooks (API-key auth)

Account, license, billing, and recovery-token issuance are **not** on this Worker — they live at `console.relaybase.xyz`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Verify → unauthorized | Admin token in the app must match `ADMIN_TOKEN` secret (or the D1 recovery override) |
| Verify → not Relaybase | Wrong URL, or deploy failed — open `/health` in a browser |
| Deploy fails on D1 id | Paste real database ids into `wrangler.toml` |
| R2 not configured in `/health` | Ensure bucket `relaybase-mailbox` exists and is bound as `INBOUND` |
| Lost ADMIN_TOKEN | Desktop app → Settings → Reset admin token (uses a `console.relaybase.xyz` recovery token; no Wrangler) |
