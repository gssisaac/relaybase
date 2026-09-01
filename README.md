# Relaybase

Monorepo for **Relaybase** — domain-scoped transactional email (send + receive) on Cloudflare. One API key per domain, built for product teams who need `billing@`, `support@`, and the rest without Google Workspace seat math.

The repo is split into two service sets:

- **End-user product** (shipped to customers): `app/`, `desktop/`, `mobile/`, `server/`.
- **HQ operations** (internal, ours): `hq/admin/`, `hq/console/`, `hq/website/`. Cloudflare resources for this set use the `strum-relaybase-*` worker names and D1 `strum-relaybase-ops` (binding `DB`; operator config only — optional `workerUrl`). Cloudflare credentials, end-user tokens, and plaintext API keys are **never** stored in that D1 — CF creds live on the product Worker as wrangler secrets, tokens in the product Worker's D1 `owner_sessions`, and plaintext keys locally in `~/.relaybase`.

| Set | Package | Path | Port | Role |
|-----|---------|------|------|------|
| End-user | **Worker** | `server/` | 8787 (`wrangler dev`) | Installable routing Worker (send, inbound, keys) installed into the customer's CF account |
| End-user | **User app** | `app/` | 32830 | Email UI — `next dev` for HMR; static export for Tauri |
| End-user | **Desktop** | `desktop/` | Tauri | Mac app shell (`devUrl` → `:32830`, prod → `app/out`) |
| End-user | **Mobile** | `mobile/` | Flutter | Teammate inbox companion (per-account mobile password) |
| HQ | **Admin** | `hq/admin/` | 32829 | Operator dashboard (licenses, logs, settings; worker `strum-relaybase-admin` at `admin.relaybase.xyz`) |
| HQ | **Console** | `hq/console/` | 32830 | Account / license / billing / recovery (worker `strum-relaybase-console` at `console.relaybase.xyz`) |
| HQ | **Website** | `hq/website/` | 32828 | Marketing site (worker `strum-relaybase-website` at `relaybase.xyz`; BYO-CF / $39 one-time positioning) |

**Product pivot:** Relaybase is a one-time Mac app that installs the Worker into the **user's** Cloudflare account. See `docs/pivot-byo-cloudflare.md` and `PRODUCT.md`.

Production API: `https://api.relaybase.xyz`. Marketing: [relaybase.xyz](https://relaybase.xyz).

For product positioning and marketer copy, see **[PRODUCT.md](./PRODUCT.md)**.

---

## Architecture

```
┌─────────────────┐     Bearer API key      ┌──────────────────┐
│  Your backend   │ ───────────────────────▶│  relaybase Worker│
│  (fetch / SDK)  │                         │  Hono on CF       │
└─────────────────┘                         └────────┬─────────┘
                                                     │
         ┌───────────────────────────────────────────┼───────────────────────────┐
         │                                           │                           │
         ▼                                           ▼                           ▼
  CF Email Sending API                         D1 (RELAYBASE_*)              R2 mailbox
  (outbound)                                   (keys, logs, mail index)      (inbound / sent)

Inbound path:

  Sender ──MX──▶ Cloudflare Email Routing ──email()──▶ Worker ──▶ R2 + D1 ──▶ webhooks / poll
```

**Admin** and **user app** are Next.js 16 dashboards. In production they call the Worker and Cloudflare APIs; in local dev they use stub APIs and JSON files under `data/`.

---

## Prerequisites

1. Node.js 22 (see `app/.node-version`, `admin/.node-version`)
2. npm 10.9.2 (`packageManager` in frontend `package.json` files)
3. Cloudflare account with **Email Sending** enabled and sending domain onboarded
4. For the **hosted** Relaybase Worker / admin: API token with Email Sending (and Email Routing) as needed. For the **Mac app**, customers self-install via `pnpm pack:worker-install` ZIP + Wrangler — the app needs Worker URL + owner passtoken session.

---

## Quick start (local dev)

### 1. Worker

```bash
cd server
npm install
cp .dev.vars.example .dev.vars
# Fill AUTH_PEPPER and CF_API_TOKEN (CF_ACCOUNT_ID is optional)

npm run dev          # wrangler dev → http://127.0.0.1:8787
```

From the repo root you can also run `npm run dev` (delegates to `server/`).

### 2. Admin dashboard

```bash
cd hq/admin && npm install
cp .env.example .env.local
# Set RELAYBASE_URL to your Worker URL (local or deployed)

npm run dev          # http://localhost:32829
```

No auth gate in dev. Operator settings persist in `data/products/relaybase/settings.json`.

### 3. User dashboard

```bash
cd app && npm install && npm run dev   # http://localhost:32830
```

Sign in with any user id (no password). Accounts live in `data/users.json` and `data/users/<id>.json`. The app uses local stub routes under `/api/email/*` — no Worker or Cloudflare calls unless you wire production env.

### 4. Desktop (Tauri)

```bash
cd desktop && pnpm install
pnpm dev   # starts app/ on :32830 and opens the Tauri window
```

Daily UI work: prefer `cd app && pnpm dev` in the browser (fast HMR). Use `desktop` when testing Worker install or the native shell (credentials temporarily in `~/.relaybase/`).

Release DMG (signing via `desktop/scripts/deploy/`, adapted from kloy):

```bash
cd desktop && pnpm run build:macos
```

Static export only (what Tauri bundles):

```bash
cd app && pnpm run build:desktop   # → app/out
```

### 5. Marketing site

```bash
cd hq/website && pnpm install && pnpm dev   # http://localhost:32828
```

From the repo root you can also run:

```bash
npm run admin:dev
npm run app:dev
npm run website:dev
```

### Diagnostics

```bash
node scripts/diagnose-relaybase.mjs
```

Reads `hq/admin/.env.local` and `data/products/relaybase/settings.json`, tests Cloudflare token, R2, and Worker connectivity without printing secrets.

---

## Repo layout

```
relaybase/
├── server/                 # End-user Cloudflare Worker (Hono) — installed into customer's CF
│   ├── src/
│   │   ├── index.ts        # fetch + email() handlers
│   │   ├── inbound.ts      # R2 storage for received mail
│   │   ├── routes/         # send, console/*, mail/*, mobile/*, v1/*
│   │   └── lib/            # auth, mime, webhooks, auth-tokens, keys
│   ├── wrangler.toml       # Worker bindings (R2, D1)
│   └── .dev.vars           # Worker secrets (local only, not committed)
├── app/                    # End-user Next.js email UI (relaybase-email)
├── desktop/                # End-user Tauri Mac shell
├── mobile/                 # End-user Flutter companion
├── hq/                  # HQ operations (internal, ours)
│   ├── admin/              # Operator Next.js dashboard (worker: strum-relaybase-admin)
│   ├── console/            # Account / license / billing (worker: strum-relaybase-console)
│   └── website/            # Marketing Next.js (static export, worker: strum-relaybase-website)
├── data/
│   ├── users.json          # User registry (shared with admin Users)
│   ├── users/<id>.json     # Per-user domain/email data (dev)
│   └── products/relaybase/ # Admin operator settings (local fallback; dev)
└── scripts/                # diagnose-relaybase
```

---

## Worker — deploy

The product Worker (`server/`) deploys into the **customer's** Cloudflare account (end-user side). It binds the `INBOUND` R2 mailbox bucket and D1 databases (`RELAYBASE_DB`, `RELAYBASE_LOGS`, `RELAYBASE_MAIL`). No KV namespace.

```bash
cd server

# Secrets
npx wrangler secret put AUTH_PEPPER
npx wrangler secret put CF_API_TOKEN
# Optional — not required for mail or the Cloudflare API
# npx wrangler secret put CF_ACCOUNT_ID

npm run deploy    # wrangler deploy
```

HQ operations workers (`strum-relaybase-admin`, `strum-relaybase-console`, `strum-relaybase-website`) deploy separately from `hq/admin`, `hq/console`, `hq/website` via `pnpm run deploy:cf` in each package. They share D1 `strum-relaybase-ops` (binding `DB`) on account `3adf03d991843094a7343eebc0a98007`. The admin worker never stores end-user tokens or plaintext API keys.

Bindings in `server/wrangler.toml`:

| Binding | Resource | Purpose |
|---------|----------|---------|
| `RELAYBASE_DB` | D1 `relaybase-db` | Catalog, API keys, auth tokens, mobile passwords, webhooks, owner config, inbound events |
| `INBOUND` | R2 `relaybase-mailbox` | Mail atoms: `inbound|sent {domain}/{id}/` (thin `meta.json` + `raw.eml` + attachments) and `sent/_sendlog/{id}.json` |
| `RELAYBASE_LOGS` | D1 `relaybase-logs` | Ops-event log (compose/API/broadcast sends + inbound bounces) |
| `RELAYBASE_MAIL` | D1 `relaybase-mail` | Mail index: `mailbox_messages` (list/counts, inbound + sent) + `mailbox_fts` (FTS5 search). Rebuildable from R2 via `POST /console/rebuild-mail` |

---

## Environment variables

### Worker (`server/wrangler.toml` vars + secrets)

| Variable | Type | Description |
|----------|------|-------------|
| `CF_API_TOKEN` | secret | Token with Email Sending + Email Routing + Zone Read (required for domain / DNS API) |
| `CF_ACCOUNT_ID` | secret | Optional. Account id is not required at runtime — see [docs/cf-oauth-install-token.md](docs/cf-oauth-install-token.md). |
| `AUTH_PEPPER` | secret | Install/hash pepper for owner passtoken (not a login token) |
| `WORKER_SCRIPT_NAME` | var | Worker name for routing helpers |
| `INBOUND_BUCKET_NAME` | var | R2 bucket name label |

### Admin (`hq/admin/.env.local`)

| Variable | Description |
|----------|-------------|
| `RELAYBASE_URL` | Worker base URL |
| `RELAYBASE_CONSOLE_URL` | Console base URL (account/license/billing) |

Cloudflare domain / DNS API uses the product Worker wrangler secret `CF_API_TOKEN`. `CF_ACCOUNT_ID` is optional. Neither lives in admin env.

### Consuming services (your apps)

| Variable | Description |
|----------|-------------|
| `RELAYBASE_API_KEY` | Domain-scoped key from `/console/keys` |
| `RELAYBASE_URL` | Worker base URL (no trailing slash) |

---

## Admin dashboard

Routes under `hq/admin/src/relaybase/`:

| Section | Path | Purpose |
|---------|------|---------|
| Status | `/status` | Platform stats, Worker health |
| Keys | `/keys` | Issue and list domain API keys |
| Logs | `/logs` | Send attempt history |
| Email | `/email`, `/email/compose` | Inbox + manual send (operator) |
| Branding | `/branding` | Domain display names |
| Settings | `/settings` | Worker URL + owner session (Cloudflare credentials live on the Worker as wrangler secrets) |

HQ admin no longer authenticates to the customer Worker. Mail and keys are managed from the desktop with an owner passtoken.

---

## User app (`relaybase-email`)

Customer-facing mailbox UI in `app/src/relaybase-email/`:

| Section | Purpose |
|---------|---------|
| Dashboard | Stats, sparklines, quick links |
| Inbox / Sent | Mail list and reading |
| Compose | Send from registered addresses |
| Accounts | Sender addresses on the domain |
| Audience | Contacts for broadcasts |
| Broadcasts | Bulk / campaign sends (dev stubs) |
| Domains | Domain connection and DNS hints |
| Settings | API keys, domain config, inbound routing |

Auth: cookie `relaybase_user` after id-only sign-in/register (`/api/auth`). Dev data in `data/users/<id>.json`.

---

## API reference

### Health

```bash
curl "$RELAYBASE_URL/health"
```

### Console & mail routes

Require an owner **console** or **mail** access token (`POST /console/login` with the passtoken). Management routes live under `/console/*` and mail operations under `/mail/*`. Operator-only endpoints (`/admin/bootstrap`, `/admin/cloudflare`, `/admin/logs`) have been removed from the worker and moved into the admin Next.js server.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/console/keys` | Issue API key (`domain`, `label`) |
| `GET` | `/console/keys` | List keys (prefix only, not full secret) |
| `GET` | `/console/ops-logs` | Ops event log (`?limit`, `?status`, `?domain`) |
| `GET` | `/console/connect` | Desktop self-install probe (owner console access) |
| `GET` | `/mail/inbox` | List inbound (`?domain`, `?limit`) |
| `GET` | `/mail/inbox/:id` | Full inbound message |
| `POST` | `/mail/inbox/routing` | Route addresses to Worker |
| `GET` | `/mail/inbox/notifications` | Pending inbound events |
| `POST` | `/mail/inbox/notifications/ack` | Ack events |

Issue a key:

```bash
curl -X POST "$RELAYBASE_URL/console/keys" \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain":"yourdomain.com","label":"billing-service"}'
```

Response includes `apiKey` **once** — store it immediately.

### Send (`/v1/send`)

Bearer domain-scoped API key.

```bash
curl -X POST "$RELAYBASE_URL/v1/send" \
  -H "Authorization: Bearer $RELAYBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "billing@yourdomain.com",
    "fromName": "Your App",
    "to": "customer@example.com",
    "subject": "Invoice #1234",
    "text": "Your invoice is ready."
  }'
```

| Field | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Must be `*@<key-domain>` |
| `fromName` | No | Display name in inbox |
| `to` | Yes | Recipient |
| `subject` | Yes | Subject line |
| `text` | Yes | Plain-text body |
| `html` | No | HTML body |
| `replyTo` | No | Reply-To address |

Success: `{"messageId":"..."}`.

### Inbound — poll events

```bash
curl "$RELAYBASE_URL/v1/inbox/events?limit=25" \
  -H "Authorization: Bearer $RELAYBASE_API_KEY"
```

Ack:

```bash
curl -X POST "$RELAYBASE_URL/v1/inbox/events/ack" \
  -H "Authorization: Bearer $RELAYBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ids":["evt_..."]}'
```

Fetch full message:

```bash
curl "$RELAYBASE_URL/v1/inbox/messages/<messageId>" \
  -H "Authorization: Bearer $RELAYBASE_API_KEY"
```

### Webhooks

Register (up to 3 per domain):

```bash
curl -X POST "$RELAYBASE_URL/v1/webhooks" \
  -H "Authorization: Bearer $RELAYBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://myapp.com/hooks/relaybase"}'
```

Response includes `secret` once. Verify `X-Relaybase-Signature: t=<unix>,v1=<hmac_sha256_hex>` on `{timestamp}.{raw_body}` (Stripe-style).

Typical flow: webhook or poll → `GET /v1/inbox/messages/:id` → your app logic.

### Error codes

| Status | Meaning |
|--------|---------|
| `400` | Invalid body or domain format |
| `401` | Missing/invalid owner session or API key |
| `403` | `from` does not match key domain |
| `404` | Unknown route or message |
| `502` | Cloudflare Email Sending API failure |

---

## Website deploy (Cloudflare)

`hq/website/` is a pnpm workspace package. See `hq/website/README.md`.

```bash
cd hq/website
pnpm install
pnpm run build:cf
pnpm run deploy:cf
```

Cloudflare project settings:

- Root directory: `hq/website`
- `SKIP_DEPENDENCY_INSTALL=1`
- Build: `npm run build:cf`
- Optional: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/diagnose-relaybase.mjs` | Operator connectivity checks |

---

## Security

- Never commit `.dev.vars`, `.env.local`, or real tokens in `data/products/`.
- Issue one API key per service/domain pair; rotate by re-issuing and updating env.
- Owner passtoken is for the desktop owner only — not for customer apps. Use domain API keys (`/v1/*`) for integrations.
- Webhook secrets are shown once at registration; verify signatures in production.
- **HQ operations D1 (`strum-relaybase-ops`) holds operator config only** — optional product Worker URL in `product_settings`. HQ does **not** store a customer Worker credential. Cloudflare credentials and owner passtoken are **never** stored there: domain / DNS API uses the product Worker's `CF_API_TOKEN` secret (`CF_ACCOUNT_ID` is optional), owner sessions live on the product Worker, and plaintext API keys live only in the local `~/.relaybase/api-keys.json` vault.

---

## Typecheck

```bash
npm run typecheck    # Worker TypeScript
```

Frontend apps: `npm run lint` in each of `hq/admin/`, `app/`, `hq/website/`.
