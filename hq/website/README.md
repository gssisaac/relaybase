# Relaybase marketing site

English marketing site for [Relaybase](https://relaybase.xyz) — product email infrastructure for builders.

## Getting started

```bash
cd hq/website
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:32828](http://localhost:32828).

`next dev` serves the static pages only. Beta signup (`POST /api/beta`) and
gated download pages (`/downloads/{uuid}`) run in the Worker — test those
after a static export:

```bash
pnpm preview:cf
```

## Deploy on Cloudflare

Static export (`out/`) plus a Worker (`src/worker/index.ts`) via Wrangler.
The Worker binds D1 `strum-relaybase-ops` (same database as console/admin) for
`beta_invites`.

In the Cloudflare project (root directory: `website`):

1. **Environment variables:**
   - `SKIP_DEPENDENCY_INSTALL` = `1`
   - `NEXT_PUBLIC_SITE_URL` = your public site URL (defaults to `https://relaybase.xyz`)
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` = GA4 measurement ID (optional)

2. **Wrangler secrets** (never commit):
   - `RELAYBASE_WORKER_URL` — product Worker that sends as `beta@relaybase.xyz`
   - `RELAYBASE_API_KEY` — domain-scoped product API key (`rb_…`) used as
     `Authorization: Bearer` on `POST /v1/send`

3. **Mailbox:** `beta@relaybase.xyz` must exist on the product Worker so
   `/v1/send` accepts `from`.

4. **D1:** apply `hq/console` migrations so `beta_invites` exists on remote
   `strum-relaybase-ops` before the first signup.

5. **Build command:** `pnpm run build:cf`

6. Deploy: `pnpm run deploy:cf`

`SKIP_DEPENDENCY_INSTALL` prevents Cloudflare from running an automatic install
against the wrong lockfile; `pnpm install --frozen-lockfile` inside `build:cf`
handles install instead.

## Desktop downloads (R2)

One Universal macOS DMG / updater `.tar.gz` (Apple Silicon + Intel) is hosted
on R2 bucket `relaybase-releases` at `https://download.relaybase.xyz`. Small
metadata (`public/release/latest.json`, `.sig`) ships with this site. Valid
beta UUIDs redirect the file download to the current DMG. See
`desktop/docs/release.md` for the full notarize + upload flow
(`cd desktop && pnpm run build:macos`).

## Stack

- Next.js 16 (static export)
- Tailwind CSS 4 + shadcn/ui
- Cloudflare Workers static assets + Worker (`strum-relaybase-website`)
- D1 `strum-relaybase-ops.beta_invites` for beta download tokens
- pnpm (`packageManager`: `pnpm@9.12.0`)
