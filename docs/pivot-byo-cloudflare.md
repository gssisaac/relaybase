# Pivot note — BYO Cloudflare desktop (supersedes prior SaaS roadmap)

- Date: 2026-08-07
- Status: **Active strategy**

## Summary

Relaybase is repositioned from a hosted multi-tenant email SaaS ($10/domain/mo on a shared Cloudflare account) to a **one-time ($39) Mac/Windows app** that:

1. Connects to the **customer's own** Cloudflare account (API token → keychain)
2. Installs the existing `server/` Worker into that account
3. Provides Spark-like inbox UX + send/receive API over CF Email Sending/Routing

This structurally removes:

- Cloudflare Self-Serve ToS risk of managing third-party domains under Relaybase's account
- Single-account SPOF / abuse blast radius described in `business-plan-risk-and-market.md`

## Relationship to `business-plan-risk-and-market.md`

That document's Phase 0–2 path (rate limits → then de-Cloudflare backends) assumed we would keep hosting email. **That hosted-SaaS path is abandoned.** Tenant-level abuse defenses on a shared account are no longer the priority; isolation is achieved by never sharing an account.

Keep `business-plan-risk-and-market.md` as historical diagnosis. Follow this file + the Cursor plan for execution.
