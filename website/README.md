# Relaybase marketing site

English marketing site for [Relaybase](https://relaybase.com) — product email infrastructure for builders.

## Getting started

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:32828](http://localhost:32828).

## Deploy on Cloudflare

Static export (`out/`) deployed via Wrangler assets (same pattern as focuslens).

In the Cloudflare project (root directory: `website`):

1. **Environment variables:**
   - `SKIP_DEPENDENCY_INSTALL` = `1`
   - `NEXT_PUBLIC_SITE_URL` = your public site URL (defaults to `https://relaybase.com`)
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` = GA4 measurement ID (optional)

2. **Build command:** `npm run build:cf`

3. Deploy with Wrangler: `npx wrangler deploy`

`SKIP_DEPENDENCY_INSTALL` prevents Cloudflare from running an automatic install against the wrong lockfile; `npm ci` inside `build:cf` handles install instead.

## Stack

- Next.js 16 (static export)
- Tailwind CSS 4 + shadcn/ui
- Cloudflare Workers static assets via `wrangler.jsonc`
