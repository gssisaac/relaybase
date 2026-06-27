# Relaybase

Monorepo for **Relaybase** — domain-scoped transactional email (send + receive) on Cloudflare. One API key per domain, built for product teams who need `billing@`, `support@`, and the rest without Google Workspace seat math.

| Package | Path | Port | Role |
|---------|------|------|------|
| **Worker** | repo root (`src/`) | 8787 (`wrangler dev`) | Send API, inbound storage, webhooks, admin routes |
| **Admin** | `admin/` | 32829 | Platform operator dashboard (keys, logs, inbox, users) |
| **User app** | `app/` | 32830 | Customer email dashboard (inbox, compose, broadcasts, settings) |
| **Website** | `website/` | 32828 | Marketing site (static export → Cloudflare) |

Production API: `https://api.relaybase.com` (or your Worker URL). Marketing: [relaybase.com](https://relaybase.com).

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
  CF Email Sending API                         Workers KV                    R2 bucket
  (outbound)                                   (keys, logs, events)          (inbound mail)

Inbound path:

  Sender ──MX──▶ Cloudflare Email Routing ──email()──▶ Worker ──▶ R2 + KV events ──▶ webhooks / poll
```

**Admin** and **user app** are Next.js 16 dashboards. In production they call the Worker and Cloudflare APIs; in local dev they use stub APIs and JSON files under `data/`.

---

## Prerequisites

1. Node.js 22 (see `app/.node-version`, `admin/.node-version`)
2. npm 10.9.2 (`packageManager` in frontend `package.json` files)
3. Cloudflare account with **Email Sending** enabled and sending domain onboarded
4. API token with **Account → Email Sending → Edit** (and **Zone → Email Routing Rules → Edit** for inbound routing)

---

## Quick start (local dev)

### 1. Worker

```bash
npm install
cp .dev.vars.example .dev.vars
# Fill CF_ACCOUNT_ID, CF_API_TOKEN, ADMIN_TOKEN

npm run dev          # wrangler dev → http://127.0.0.1:8787
```

### 2. Admin dashboard

```bash
cd admin && npm install
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

### 4. Marketing site

```bash
cd website && npm install && npm run dev   # http://localhost:32828
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

Reads `admin/.env.local` and `data/products/relaybase/settings.json`, tests Cloudflare token, R2, and Worker connectivity without printing secrets.

---

## Repo layout

```
relaybase/
├── src/                    # Cloudflare Worker (Hono)
│   ├── index.ts            # fetch + email() handlers
│   ├── inbound.ts          # R2 storage for received mail
│   ├── routes/             # send, admin/*, v1/*
│   └── lib/                # auth, mime, webhooks, KV helpers
├── admin/                  # Operator Next.js app
├── app/                    # Customer Next.js app (relaybase-email UI)
├── website/                # Marketing Next.js (static export)
├── data/
│   ├── users.json          # User registry (shared with admin Users)
│   ├── users/<id>.json     # Per-user domain/email data (dev)
│   └── products/relaybase/ # Admin product settings + vault (dev)
├── scripts/                # provision-domain-key, diagnose-relaybase
├── wrangler.toml           # Worker bindings (KV, R2)
└── .dev.vars               # Worker secrets (local only, not committed)
```

---

## Worker — deploy

```bash
# Create KV namespace (once)
wrangler kv namespace create KEYS
wrangler kv namespace create KEYS --preview
# Update wrangler.toml with id and preview_id

# Secrets
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_API_TOKEN
wrangler secret put ADMIN_TOKEN

npm run deploy    # wrangler deploy
```

Bindings in `wrangler.toml`:

| Binding | Resource | Purpose |
|---------|----------|---------|
| `KEYS` | Workers KV | API keys, send logs, inbound events, webhook registry |
| `INBOUND` | R2 `relaybase-inbound` | Raw inbound mail (`meta.json`, `raw.eml`, attachments) |

---

## Environment variables

### Worker (`wrangler.toml` vars + secrets)

| Variable | Type | Description |
|----------|------|-------------|
| `CF_ACCOUNT_ID` | secret | Cloudflare account ID |
| `CF_API_TOKEN` | secret | Token with Email Sending edit |
| `ADMIN_TOKEN` | secret | Bearer token for `/admin/*` routes |
| `WORKER_SCRIPT_NAME` | var | Worker name for routing helpers |
| `INBOUND_BUCKET_NAME` | var | R2 bucket name label |

### Admin (`admin/.env.local`)

| Variable | Description |
|----------|-------------|
| `RELAYBASE_URL` | Worker base URL |
| `RELAYBASE_CF_ACCOUNT_ID` | Cloudflare account |
| `RELAYBASE_CF_API_TOKEN` | Email Sending / account API |
| `RELAYBASE_CF_ZONE_ID` | Zone for Email Routing |
| `RELAYBASE_CF_DNS_API_TOKEN` | DNS / routing rules token |
| `RELAYBASE_INBOUND_R2_BUCKET` | Inbound bucket name |

### Consuming services (your apps)

| Variable | Description |
|----------|-------------|
| `RELAYBASE_API_KEY` | Domain-scoped key from `/admin/keys` |
| `RELAYBASE_URL` | Worker base URL (no trailing slash) |

---

## Admin dashboard

Routes under `admin/src/relaybase/`:

| Section | Path | Purpose |
|---------|------|---------|
| Status | `/status` | Platform stats, Worker health |
| Keys | `/keys` | Issue and list domain API keys |
| Logs | `/logs` | Send attempt history |
| Email | `/email`, `/email/compose` | Inbox + manual send (operator) |
| Branding | `/branding` | Domain display names |
| Settings | `/settings` | Worker URL, Cloudflare credentials |
| Users | `/users` | Customer accounts (`data/users.json`) |

Admin API routes proxy to the Worker (`admin/src/app/api/relaybase/*`) using `ADMIN_TOKEN` from product settings.

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
| Metrics | Delivery stats |
| Settings | API keys, domain config, inbound routing |

Auth: cookie `relaybase_user` after id-only sign-in/register (`/api/auth`). Dev data in `data/users/<id>.json`.

---

## API reference

### Health

```bash
curl "$RELAYBASE_URL/health"
```

### Admin routes

Require `Authorization: Bearer $ADMIN_TOKEN`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/keys` | Issue API key (`domain`, `label`) |
| `GET` | `/admin/keys` | List keys (prefix only, not full secret) |
| `GET` | `/admin/logs` | Send logs (`?limit`, `?status`, `?domain`) |
| `GET` | `/admin/inbox` | List inbound (`?domain`, `?limit`) |
| `GET` | `/admin/inbox/:id` | Full inbound message |
| `POST` | `/admin/inbox/routing` | Route addresses to Worker |
| `GET` | `/admin/inbox/notifications` | Pending inbound events |
| `POST` | `/admin/inbox/notifications/ack` | Ack events |

Issue a key:

```bash
curl -X POST "$RELAYBASE_URL/admin/keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
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
| `401` | Missing/invalid admin token or API key |
| `403` | `from` does not match key domain |
| `404` | Unknown route or message |
| `502` | Cloudflare Email Sending API failure |

---

## Website deploy (Cloudflare)

`website/` is a standalone npm project (not pnpm). See `website/README.md`.

```bash
cd website
npm ci
npm run build:cf
npx wrangler deploy
```

Cloudflare project settings:

- Root directory: `website`
- `SKIP_DEPENDENCY_INSTALL=1`
- Build: `npm run build:cf`
- Optional: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/diagnose-relaybase.mjs` | Operator connectivity checks |
| `scripts/provision-domain-key.mjs` | Issue a domain key via admin API |

---

## Security

- Never commit `.dev.vars`, `.env.local`, or real tokens in `data/products/`.
- Issue one API key per service/domain pair; rotate by re-issuing and updating env.
- `ADMIN_TOKEN` is operator-only — not for customer apps.
- Webhook secrets are shown once at registration; verify signatures in production.

---

## Typecheck

```bash
npm run typecheck    # Worker TypeScript
```

Frontend apps: `npm run lint` in each of `admin/`, `app/`, `website/`.
