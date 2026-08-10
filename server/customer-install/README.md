# Relaybase Worker — install into your Cloudflare account

This package deploys the Relaybase routing Worker into **your** account. The Mac app never needs Workers/KV/R2 API permissions — you deploy with Wrangler, then paste the Worker URL and admin token into the app.

## Prerequisites

- A Cloudflare account
- Node.js 20+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npx wrangler` is enough)

## 1. Create storage (exact names)

```bash
npx wrangler kv namespace create relaybase-app
npx wrangler r2 bucket create relaybase-inbound
```

Copy the KV **id** into `wrangler.toml` (replace the `REPLACE_WITH_relaybase-app_ID` placeholder).

Why these names: the Mac app and docs refer to them; keeping the names makes support and upgrades predictable. Other Workers in your account are untouched.

## 2. Install deps and set admin secret

```bash
npm install
npx wrangler secret put ADMIN_TOKEN
```

Choose a long random value (e.g. `openssl rand -hex 24`). **Save it** — you will paste the same value into the Relaybase Mac app.

Optional (needed later for Email Sending / zone automation from the Worker itself):

```bash
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_API_TOKEN
```

## 3. Deploy

```bash
npx wrangler deploy
```

Wrangler prints a URL like `https://relaybase-api.<your-subdomain>.workers.dev`.

## 4. Connect the Mac app

1. Open Relaybase → **Install routing Worker**
2. Paste the Worker URL and the same `ADMIN_TOKEN`
3. Tap **Verify & continue**

The app calls `GET /console/connect` on your Worker with that token. No Cloudflare Account API token is sent to Relaybase.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Verify → unauthorized | Admin token in the app must match `ADMIN_TOKEN` secret |
| Verify → not Relaybase | Wrong URL, or deploy failed — open `/health` in a browser |
| Deploy fails on KV id | Paste real namespace ids into `wrangler.toml` |
| R2 not configured in `/health` | Ensure bucket `relaybase-inbound` exists and is bound as `INBOUND` |
