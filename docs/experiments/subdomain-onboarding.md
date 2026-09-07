# Experiment: Subdomain onboarding (GW coexistence)

**Status:** Parked — not merged to `staging`. Preserved on branch `feat/subdomain-onboarding` in `relaybase-main` and `relaybase-worker`.

**Date:** 2026-09-07

## Goal

Let Relaybase users onboard a **subdomain** (e.g. `mail.example.com`) when the apex domain already uses Google Workspace (or another provider) on root MX. Sending + Routing should run on the subdomain without breaking apex mail.

## What was built

### Worker (`relaybase-worker`)

| File | Purpose |
|------|---------|
| `src/lib/zone-resolution.ts` | Walk-up parent zone resolution (`mail.strum.us` → zone `strum.us`) |
| `src/lib/subdomain-onboard.ts` | Onboard Sending + create Routing DNS (MX/SPF) on subdomain |
| `src/routes/console/subdomain-onboard.ts` | `POST /console/subdomain-onboard` |
| `src/routes/console/domains.ts` | Return `subdomain_candidate` when input is subdomain under known zone |
| `src/lib/sending-onboard.ts` | Use parent zone resolution for sending |
| `src/app.ts` | Register subdomain-onboard route |

### App (`relaybase-main`)

| File | Purpose |
|------|---------|
| `app/src/console/pages/domains/SubdomainOnboardDialog.tsx` | Reusable onboarding dialog (input subdomain, steps, CF dashboard link, Verify) |
| `app/src/lib/dashboard/domain-store.ts` | `DomainSubdomainCandidateError`, auto-open dialog |
| `app/src/console/pages/domains/DomainsView.tsx` | MX conflict → "Use subdomain instead"; wire dialog |
| `app/src/console/pages/domains/FixSendingDialog.tsx` | `no_zone` → "Onboard as subdomain" |
| `app/src/lib/desktop/api/email-api-map.ts` | Map `/api/email/subdomain-onboard` |
| `app/src/lib/desktop/bridge/cloudflare.ts` | `cloudflareEmailRoutingUrl()` helper |

### Entry points

1. **Add domain** with a subdomain → dedicated onboarding dialog.
2. **MX conflict** (GW on apex) → suggest subdomain onboarding.
3. **Fix sending `no_zone`** → onboard as subdomain.

## Dogfood testing

Worker **0.1.2** was deployed to Cloudflare for testing (`relaybase-api` on account `3adf03d991843094a7343eebc0a98007`). Test zone: `strum.us` (GW MX on apex).

## Findings — Cloudflare Email Routing

### What works

- **Email Sending** on a subdomain is a **separate domain** in CF. API `POST /zones/{zoneId}/email/sending/subdomains` works without touching apex MX. Relaybase worker already onboards sending successfully; DNS shows `cf-bounce.mail.strum.us` records.
- **DNS for routing on subdomain:** Worker can create `mail.strum.us` MX → `route*.mx.cloudflare.net` and SPF TXT via DNS API.

### What does not work (blocker)

**Email Routing subdomain cannot be enabled when the apex zone is not onboarded to Email Routing.**

Cloudflare's model:

1. **Zone onboarding** (`POST /zones/{zone_id}/email/routing/dns`) adds and **locks** CF MX/SPF/DKIM on the **apex**. Conflicts with existing GW MX → onboarding fails or would replace GW mail.
2. **"Add subdomain"** (dashboard: zone → Email Routing → Settings → Subdomains) only appears **after** the zone is onboarded to Email Routing.
3. **No public API** to add a routing subdomain. Full Email Routing API list has no `subdomains` resource; subdomain add is dashboard-only.

Account-level **"+ Onboard Domain"** (`/email-service/routing/onboarding`) is zone selection only — it onboard the **apex**, not `mail.strum.us`. Searching `mail.strum.us` in the zone dropdown returns "No results found" because it is not a zone.

### Observed on `strum.us`

- Apex has Google Workspace MX (`aspmx.l.google.com`, etc.).
- `strum.us` does **not** appear in account Email Routing domain list.
- Worker created `mail.strum.us` MX/SPF in DNS, but routing rules / CF routing UI do not treat the subdomain as onboarded.
- Dashboard link fixes during experiment:
  - Wrong: `/strum/email-service/routing` (hardcoded zone name)
  - Wrong: account-level onboarding only
  - Intended: zone-level `/email-service/routing` with zone ID — still insufficient without prior zone onboard

### Risky workaround (not recommended)

Theoretically: temporarily onboard apex (breaks GW) → add subdomain in Settings → unlock apex MX → restore GW MX. Problems:

- GW downtime during step 1
- Zone may enter `misconfigured` / `unlocked` state
- Unknown whether subdomain routing survives after apex unlock + GW MX restore
- Not acceptable for production GW domains

References:

- [CF Email Routing — Subdomains](https://developers.cloudflare.com/email-service/configuration/subdomains/)
- [CF Email Routing subdomain blog](https://blog.cloudflare.com/email-routing-subdomains/)
- [Community: subdomain only if root onboarded](https://community.cloudflare.com/t/cloudflare-email-on-sub-domains/616639)
- [Domain configuration / MX conflicts](https://developers.cloudflare.com/email-routing/setup/email-routing-dns-records/)

## UI notes from experiment

- Red `text-destructive` for "dashboard required" looked like an error → changed to brand callout + external link.
- Too many footer buttons during manual CF step → phase-based footer (`input` / `onboarding` / `dashboard_required` / `verified`).
- Hardcoded `mail.` suggestion → editable subdomain input in dialog (prefill only).

## Recommendation for future work

| Path | Notes |
|------|--------|
| **Sending-only subdomain** | Ship what works today: onboard sending on subdomain; document that inbound routing requires CF limitations or manual GW catch-all forward to subdomain. |
| **Full routing on subdomain** | Blocked by CF unless apex Email Routing is enabled or CF ships subdomain API / GW-coexistence onboarding. Revisit when CF docs/API change. |
| **GW catch-all → subdomain** | Operational pattern: GW catch-all forwards to `@mail.strum.us`; CF routing on subdomain still needs CF-side onboard (same blocker). |

## How to resume

```bash
# relaybase-worker
git fetch origin
git checkout feat/subdomain-onboarding

# relaybase-main
git fetch origin
git checkout feat/subdomain-onboarding
```

Pair worker **0.1.2+** with app on this branch for end-to-end retest.
