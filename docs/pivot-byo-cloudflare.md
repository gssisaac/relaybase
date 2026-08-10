# Pivot note — BYO Cloudflare desktop (supersedes prior SaaS roadmap)

- Date: 2026-08-07
- Updated: 2026-08-08 (user self-install)
- Status: **Active strategy**

## Summary

Relaybase is repositioned from a hosted multi-tenant email SaaS ($10/domain/mo on a shared Cloudflare account) to a **one-time ($39) Mac/Windows app** that:

1. Ships a **Worker install ZIP** (`relaybase-worker-install`) — the customer deploys with Wrangler into **their** Cloudflare account
2. The Mac app only collects **Worker URL + admin token**, verifies via `GET /console/connect`, then activates a license
3. Provides Spark-like inbox UX + send/receive API over CF Email Sending/Routing

The desktop app **does not** request Account Workers / KV / R2 API permissions for install. Optional CF API tokens may return later for Zone/Email assist only.

This structurally removes:

- Cloudflare Self-Serve ToS risk of managing third-party domains under Relaybase's account
- Single-account SPOF / abuse blast radius described in `business-plan-risk-and-market.md`

## Install artifacts

- Template: `server/customer-install/`
- Pack: `pnpm pack:worker-install` → `website/public/downloads/relaybase-worker-install.zip`
- Public URL: `https://relaybase.xyz/downloads/relaybase-worker-install.zip`

## Setup flow (desktop)

1. `/setup/install` — download ZIP, Wrangler guide, paste URL + `ADMIN_TOKEN`, verify
2. `/setup/license` — activate one-time license
3. Dashboard

Credentials (temporary): `~/.relaybase/credentials.json`

## Relationship to `business-plan-risk-and-market.md`

That document's Phase 0–2 path (rate limits → then de-Cloudflare backends) assumed we would keep hosting email. **That hosted-SaaS path is abandoned.** Tenant-level abuse defenses on a shared account are no longer the priority; isolation is achieved by never sharing an account.

Keep `business-plan-risk-and-market.md` as historical diagnosis. Follow this file + the Cursor plan for execution.
