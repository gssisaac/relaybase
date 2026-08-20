# Pivot note — BYO Cloudflare desktop + central console (supersedes prior SaaS roadmap)

- Date: 2026-08-07
- Updated: 2026-08-20 (D1 `kembo-ops` replaces Kembo KV + `kembo-accounts`)
- Status: **Active strategy**

## Summary

Relaybase is a **one-time** Mac/Windows desktop app (see `PRICING.md` for current prices — Early Access $35, regular $69, optional $25/yr update renewal; the old "$39" figure is superseded) that:

1. Installs a **routing Worker** into **the customer's own** Cloudflare account — by default the desktop runs Wrangler in the background (paste a CF API token, watch the install log), with manual Wrangler as a fallback.
2. Talks only to that Worker (`/mail/*`, `/console/*`, `/mobile/*`, `/v1/*`) for product operations.
3. Delegates **account, license, billing, and ADMIN_TOKEN recovery** to a separate central Next.js app at `console.relaybase.xyz` (OpenNext on Cloudflare Workers). The product Worker no longer hosts license/waitlist/account routes.

The desktop app never sends the customer's Cloudflare API token to Relaybase — the token stays on the user's Mac and is used locally by Tauri to run Wrangler against the user's own account.

This structurally removes:

- Cloudflare Self-Serve ToS risk of managing third-party domains under Relaybase's account (the central server has no CF deploy permissions)
- Single-account SPOF / abuse blast radius described in `business-plan-risk-and-market.md`

## Architecture (post-split)

| Deployable | URL / artifact | Role |
|---|---|---|
| Product Worker | customer `*.workers.dev` + isaac dogfood `relaybase-api.gssisaac.worker.dev` | mail/console/mobile/v1 product routes only (no license/account/billing) |
| Console (kembo) | `console.relaybase.xyz` (Next.js, OpenNext, worker `kembo-console`) | account, auth, license, Stripe billing, recovery-token issuance. Durable state in D1 `kembo-ops` |
| Website (kembo) | `relaybase.xyz` (static, worker `kembo-website`) | marketing; login/signup/account links → `console.relaybase.xyz` |
| Admin (kembo) | `admin.relaybase.xyz` (OpenNext, worker `kembo-admin`) | internal ops; license admin proxies to `console.relaybase.xyz`. Shares D1 `kembo-ops` (`product_settings` only) — never end-user tokens or plaintext API keys. See **[kembo-ops-d1.md](./kembo-ops-d1.md)** |
| Customer install template | `server/customer-install/` (packed to `kembo/website/public/downloads/relaybase-worker-install.zip`) | sanitized Worker template for customer accounts |

The old `api.relaybase.xyz` custom domain was removed; isaac's dogfood Worker runs on its default `relaybase-api.gssisaac.worker.dev` URL.

## Setup flow (desktop)

1. `/setup/account` — log in or create a Relaybase account at `console.relaybase.xyz` (session stored locally)
2. `/setup/install` — auto-install (paste CF API token → Tauri runs Wrangler → install log → auto-fill Worker URL + ADMIN_TOKEN) or manual install (download ZIP, Wrangler, paste URL + token)
3. Desktop registers the Worker URL with `console.relaybase.xyz` (`/v1/account?action=worker/register`) so the account ↔ Worker mapping is known for recovery
4. Dashboard

Team users skip steps 1–2 and sign in at `/login` with their account email + per-account mobile password (same model as the Flutter companion); they get email-only mode (no management console).

Credentials: `~/.relaybase/credentials.json` (admin) and `~/.relaybase/team-login.json` (team user).

## Recovery

- **Console admin password lost** → `console.relaybase.xyz/recover` (email link).
- **ADMIN_TOKEN lost** → desktop Settings → Reset admin token: the console issues a one-time recovery token (emailed), the desktop posts it + a new admin token to the customer Worker `/console/recover-admin`, which verifies with the console and writes the new token to D1 `owner_config` (no Wrangler).

## Relationship to `business-plan-risk-and-market.md`

That document's Phase 0–2 path (rate limits → then de-Cloudflare backends) assumed we would keep hosting email. **That hosted-SaaS path is abandoned.** Tenant-level abuse defenses on a shared account are no longer the priority; isolation is achieved by never sharing an account.

Keep `business-plan-risk-and-market.md` as historical diagnosis. Follow this file + the Cursor plan for execution.
