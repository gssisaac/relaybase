# Pivot note — BYO Cloudflare desktop + central console (supersedes prior SaaS roadmap)

- Date: 2026-08-07
- Updated: 2026-08-30 (D1 `strum-relaybase-ops` on the Strum account; workers `strum-relaybase-*`)
- Status: **Active strategy**

## Summary

Relaybase is a **one-time** Mac/Windows desktop app (price numbers in `PRICING.md` are an **internal draft** until official paid launch — see that file §0 and `STRATEGY.md` §9; the old "$39" figure is superseded even as a draft) that:

1. Installs a **routing Worker** into **the customer's own** Cloudflare account — by default the desktop runs Wrangler in the background (paste a CF API token, watch the install log), with manual Wrangler as a fallback.
2. Talks only to that Worker (`/mail/*`, `/console/*`, `/mobile/*`, `/v1/*`) for product operations.
3. Delegates **account, license, and billing** to a separate central Next.js app at `console.relaybase.xyz` (OpenNext on Cloudflare Workers). The product Worker no longer hosts license/waitlist/account routes. Lost passtoken uses desktop Cloudflare OAuth (`reset-admin`), not the console.

The desktop app never sends the customer's Cloudflare API token to Relaybase — the token stays on the user's Mac and is used locally by Tauri to run Wrangler against the user's own account.

This structurally removes:

- Cloudflare Self-Serve ToS risk of managing third-party domains under Relaybase's account (the central server has no CF deploy permissions)
- Single-account SPOF / abuse blast radius described in `business-plan-risk-and-market.md`

## Architecture (post-split)

| Deployable | URL / artifact | Role |
|---|---|---|
| Product Worker | customer `*.workers.dev` + isaac dogfood `relaybase-api.gssisaac.worker.dev` | mail/console/mobile/v1 product routes only (no license/account/billing) |
| Console (hq) | `console.relaybase.xyz` (Next.js, OpenNext, worker `strum-relaybase-console`) | account, auth, license, Stripe billing, recovery-token issuance. Durable state in D1 `strum-relaybase-ops` |
| Website (hq) | `relaybase.xyz` (static, worker `strum-relaybase-website`) | marketing; login/signup/account links → `console.relaybase.xyz` |
| Admin (hq) | `admin.relaybase.xyz` (OpenNext, worker `strum-relaybase-admin`) | internal ops; license + beta admin read `strum-relaybase-ops` D1 directly. Shares D1 `strum-relaybase-ops` (`product_settings` + `beta_invites` + `licenses`) — never end-user tokens or plaintext API keys. See **[hq-ops-d1.md](../architecture/hq-ops-d1.md)** |
| Customer install template | `../relaybase-worker/customer-install/` (packed to `hq/website/public/downloads/relaybase-worker-install.zip`) | sanitized Worker template for customer accounts |

The old `api.relaybase.xyz` custom domain was removed; isaac's dogfood Worker runs on its default `relaybase-api.gssisaac.worker.dev` URL.

## Setup flow (desktop)

1. `/setup/account` — log in or create a Relaybase account at `console.relaybase.xyz` (session stored locally)
2. `/setup/install` — auto-install (Cloudflare OAuth → Tauri deploys → Worker issues owner passtoken once) or manual install (download ZIP, Wrangler, paste URL; app issues passtoken)
3. Desktop registers the Worker URL with `console.relaybase.xyz` (`/v1/account?action=worker/register`) so the account ↔ Worker mapping is known for recovery
4. Dashboard

Team users skip steps 1–2 and sign in at `/login` with their account email + per-account mobile password (same model as the Flutter companion); they get email-only mode (no management console).

Workspace: `~/.relaybase/workspace.json` (owner) and `~/.relaybase/team-login.json` (team user).

## Recovery

- **Console admin password lost** → `console.relaybase.xyz/recover` (email link).
- **Owner passtoken lost** → desktop **Setup → I forgot my passtoken**. Cloudflare OAuth re-issues a passtoken (`reset-admin`). Do not use console email recovery.

## Relationship to `business-plan-risk-and-market.md`

That document's Phase 0–2 path (rate limits → then de-Cloudflare backends) assumed we would keep hosting email. **That hosted-SaaS path is abandoned.** Tenant-level abuse defenses on a shared account are no longer the priority; isolation is achieved by never sharing an account.

Keep `business-plan-risk-and-market.md` as historical diagnosis. Follow this file + the Cursor plan for execution.
