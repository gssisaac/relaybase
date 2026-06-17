# flare-email-sender

A lightweight Cloudflare Worker that issues domain-scoped API keys and sends transactional email via [Cloudflare Email Sending](https://developers.cloudflare.com/email-routing/email-workers/send-email/).

Use this service from your apps when you need to send email from addresses like `billing@yourdomain.com` without embedding Cloudflare credentials in every project.

## Overview

```
Your app  ──Bearer API key──▶  flare-email-sender Worker  ──▶  Cloudflare Email Sending API
Admin     ──Bearer ADMIN_TOKEN──▶  /admin/keys  ──▶  Workers KV (key ↔ domain mapping)
```

Each API key is bound to exactly one sending domain. The `from` address on every send request must belong to that domain.

## Prerequisites

1. A Cloudflare account with **Email Sending** enabled.
2. Your sending domain onboarded in **Cloudflare Dashboard → Email → Email Sending** (DNS verified).
3. A Cloudflare API token with **Account → Email Sending → Edit**.

## Deploy

```bash
cd flare-email-sender
npm install

# Create KV namespace for production and preview
wrangler kv namespace create KEYS
wrangler kv namespace create KEYS --preview

# Update wrangler.toml with the returned id and preview_id values.

# Set secrets
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_API_TOKEN
wrangler secret put ADMIN_TOKEN

wrangler deploy
```

After deploy, note your Worker URL (e.g. `https://flare-email-sender.<account>.workers.dev`).

## Local development

```bash
cp .dev.vars.example .dev.vars
# Fill in CF_ACCOUNT_ID, CF_API_TOKEN, and ADMIN_TOKEN

npm run dev
```

## Admin API

Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`.

### Issue an API key

```bash
curl -X POST "https://flare-email-sender.<account>.workers.dev/admin/keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "yourdomain.com",
    "label": "billing-service"
  }'
```

Response (`201`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "fes_xxxxxxxxxxxxxxxxxxxxxxxx",
  "domain": "yourdomain.com",
  "label": "billing-service",
  "createdAt": "2026-06-16T12:00:00.000Z"
}
```

**Store `apiKey` immediately.** It is shown only once and cannot be retrieved later.

### List issued keys

```bash
curl "https://flare-email-sender.<account>.workers.dev/admin/keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Response (`200`):

```json
{
  "keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "keyPrefix": "xxxxxxxx",
      "domain": "yourdomain.com",
      "label": "billing-service",
      "createdAt": "2026-06-16T12:00:00.000Z",
      "active": true
    }
  ]
}
```

### List send logs

Every `/v1/send` attempt is recorded in Workers KV (success and failure). Use this for ops monitoring.

```bash
curl "https://flare-email-sender.<account>.workers.dev/admin/logs?limit=100&status=failed" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Query parameters:

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `100` | Max entries to return (up to 500) |
| `status` | `all` | `all`, `failed`, or `success` |
| `domain` | — | Filter by sending domain |

Response (`200`):

```json
{
  "logs": [
    {
      "id": "…",
      "at": "2026-06-17T12:00:00.000Z",
      "ok": false,
      "status": 502,
      "domain": "yourdomain.com",
      "keyId": "…",
      "keyPrefix": "xxxxxxxx",
      "keyLabel": "billing-service",
      "from": "billing@yourdomain.com",
      "to": "customer@example.com",
      "subject": "Invoice #1234",
      "error": "Cloudflare Email Sending API error …"
    }
  ],
  "summary": {
    "total": 42,
    "failed": 3,
    "failedLast24h": 1
  }
}
```

## Send email (consumer integration)

Use a domain-scoped API key in the `Authorization` header.

### cURL

```bash
curl -X POST "https://flare-email-sender.<account>.workers.dev/v1/send" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "billing@yourdomain.com",
    "fromName": "Your App",
    "to": "customer@example.com",
    "subject": "Invoice #1234",
    "text": "Your invoice is ready. View it at https://yourdomain.com/invoices/1234"
  }'
```

Response (`200`):

```json
{
  "messageId": "abc123"
}
```

### Node.js / TypeScript

```ts
const FLARE_EMAIL_SENDER_URL = process.env.FLARE_EMAIL_SENDER_URL!;
const FLARE_EMAIL_API_KEY = process.env.FLARE_EMAIL_API_KEY!;

export async function sendBillingEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const res = await fetch(`${FLARE_EMAIL_SENDER_URL}/v1/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLARE_EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "billing@yourdomain.com",
      fromName: "Your App",
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Email send failed (${res.status})`);
  }

  return (await res.json()) as { messageId: string };
}
```

### Request body

| Field | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Sender address. Must be `*@<key-domain>` (e.g. `billing@yourdomain.com`) |
| `fromName` | No | Sender display name shown in the recipient's inbox (e.g. `MacPurity` instead of `billing`) |
| `to` | Yes | Recipient email address |
| `subject` | Yes | Email subject |
| `text` | Yes | Plain-text body |
| `html` | No | HTML body |
| `replyTo` | No | Reply-To address |

## Environment variables for consuming services

| Variable | Required | Description |
|----------|----------|-------------|
| `FLARE_EMAIL_API_KEY` | Yes | Domain-scoped API key issued via `/admin/keys` |
| `FLARE_EMAIL_SENDER_URL` | Yes | Worker base URL (no trailing slash) |

## Error reference

| Status | Meaning |
|--------|---------|
| `400` | Invalid request body or domain format |
| `401` | Missing/invalid `ADMIN_TOKEN` or API key |
| `403` | `from` address does not match the key's domain |
| `404` | Unknown route |
| `502` | Cloudflare Email Sending API failure (see `error` message for hints) |

## Security

- Never commit API keys or `ADMIN_TOKEN` to source control.
- Issue one API key per service/domain pair.
- Rotate keys by issuing a new key and updating the consuming service's env var.
- `ADMIN_TOKEN` should only be used by trusted operators for key management.

## Health check

```bash
curl "https://flare-email-sender.<account>.workers.dev/health"
# {"ok":true}
```

## API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Health check |
| `POST` | `/admin/keys` | `ADMIN_TOKEN` | Issue a new API key |
| `GET` | `/admin/keys` | `ADMIN_TOKEN` | List issued keys |
| `GET` | `/admin/logs` | `ADMIN_TOKEN` | List send attempt logs |
| `POST` | `/v1/send` | API key | Send an email |
