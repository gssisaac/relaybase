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

## Inbound email (Worker + R2/KV)

Inbound mail is handled by the Worker's `email()` handler — no Gmail forwarding.

```
Sender ──MX──▶ Cloudflare Email Routing ──Worker──▶ flare-email-sender ──▶ R2
```

Objects are stored in the shared R2 bucket `flare-email-inbound` under `inbound/{domain}/{id}/` — `meta.json`, `raw.eml` (body-only when attachments exist), and `attachments/` for binary files.

### Route addresses to the Worker

From ops-dashboard: **MacPurity → Email → Settings → Domain → Route to Worker (R2)**

Or via API:

```bash
curl -X POST "https://flare-email-sender.<account>.workers.dev/admin/inbox/routing" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "macpurity.com",
    "addresses": ["support@macpurity.com"]
  }'
```

Requires Email Routing enabled on the zone and API token with **Zone → Email Routing Rules → Edit**.

### List received mail

```bash
curl "https://flare-email-sender.<account>.workers.dev/admin/inbox?domain=macpurity.com&limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```bash
curl "https://flare-email-sender.<account>.workers.dev/admin/inbox/<message-id>" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

ops-dashboard **MacPurity → Email → Received** reads these endpoints when flare-email-sender is configured.

### Inbound events (API key — poll for new mail)

When mail arrives, the Worker enqueues a lightweight event in KV. Poll with your domain-scoped API key (no persistent connection required).

```bash
# Poll pending events (run on a schedule, e.g. every 60s)
curl "https://flare-email-sender.<account>.workers.dev/v1/inbox/events?limit=25" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY"
```

Response (`200`):

```json
{
  "events": [
    {
      "id": "evt_550e8400-e29b-41d4-a716-446655440000",
      "type": "inbound.email.received",
      "createdAt": "2026-06-23T12:00:00.000Z",
      "data": {
        "messageId": "550e8400-e29b-41d4-a716-446655440000",
        "domain": "yourdomain.com",
        "from": "user@sender.com",
        "to": "support@yourdomain.com",
        "subject": "Hello",
        "preview": "First 200 chars of body…",
        "receivedAt": "2026-06-23T12:00:00.000Z",
        "hasAttachments": false
      }
    }
  ]
}
```

Acknowledge consumed events:

```bash
curl -X POST "https://flare-email-sender.<account>.workers.dev/v1/inbox/events/ack" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ids":["evt_550e8400-e29b-41d4-a716-446655440000"]}'
```

Fetch full message body after receiving an event:

```bash
curl "https://flare-email-sender.<account>.workers.dev/v1/inbox/messages/<messageId>" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY"
```

List messages without polling events:

```bash
curl "https://flare-email-sender.<account>.workers.dev/v1/inbox/messages?limit=50" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY"
```

The API key's domain scopes all `/v1/inbox/*` and `/v1/webhooks` routes — no `domain` query parameter needed.

### Webhooks (API key — push on receive)

Register a URL to receive `inbound.email.received` events immediately when mail arrives. Up to 3 webhooks per domain.

```bash
curl -X POST "https://flare-email-sender.<account>.workers.dev/v1/webhooks" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://myapp.com/hooks/flare-email"}'
```

Response (`201`):

```json
{
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "yourdomain.com",
    "url": "https://myapp.com/hooks/flare-email",
    "createdAt": "2026-06-23T12:00:00.000Z",
    "active": true
  },
  "secret": "whsec_xxxxxxxx"
}
```

**Store `secret` immediately** — it is shown only once. Use it to verify `X-Flare-Signature` on each delivery:

```
X-Flare-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>
```

Signed payload: `{timestamp}.{raw_json_body}` (same pattern as Stripe webhooks).

```typescript
import crypto from "crypto";

function verifyFlareSignature(
  secret: string,
  body: string,
  header: string,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signed = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signed)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}
```

List or remove webhooks:

```bash
curl "https://flare-email-sender.<account>.workers.dev/v1/webhooks" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY"

curl -X DELETE "https://flare-email-sender.<account>.workers.dev/v1/webhooks/<id>" \
  -H "Authorization: Bearer $FLARE_EMAIL_API_KEY"
```

**n8n / Zapier**: use the Webhooks node with your registered URL; verify the signature in a Function node if needed.

### Typical integration flow

1. Receive `inbound.email.received` (webhook push **or** events poll)
2. `GET /v1/inbox/messages/{messageId}` for full body
3. Run your app logic (ticket creation, Slack notification, etc.)

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
| `GET` | `/admin/inbox` | `ADMIN_TOKEN` | List received mail (`?domain=`) |
| `GET` | `/admin/inbox/:id` | `ADMIN_TOKEN` | Get received mail with body |
| `GET` | `/admin/inbox/notifications` | `ADMIN_TOKEN` | List pending inbound events (`?domain=`) |
| `POST` | `/admin/inbox/notifications/ack` | `ADMIN_TOKEN` | Acknowledge consumed events |
| `POST` | `/admin/inbox/routing` | `ADMIN_TOKEN` | Route addresses to this Worker |
| `GET` | `/v1/inbox/events` | API key | Poll pending inbound events |
| `POST` | `/v1/inbox/events/ack` | API key | Acknowledge consumed events |
| `GET` | `/v1/inbox/messages` | API key | List received mail for key domain |
| `GET` | `/v1/inbox/messages/:id` | API key | Get received mail with body |
| `POST` | `/v1/webhooks` | API key | Register inbound webhook |
| `GET` | `/v1/webhooks` | API key | List registered webhooks |
| `DELETE` | `/v1/webhooks/:id` | API key | Remove a webhook |
| `POST` | `/v1/send` | API key | Send an email |
