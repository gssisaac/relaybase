# CRM Compliance & Platform Improvements Backlog

**Status:** Active engineering checklist  
**Scope:** `hq/crm` + `app/src/crm` (Audience Group → Broadcast model)  
**Date:** 2026-09-15  

Related: [`crm-audience-broadcast-model.md`](./crm-audience-broadcast-model.md), [`crm-mode-v0.2.md`](./crm-mode-v0.2.md).

---

## Context

The original four-layer spec (`Account → Campaign → Subscriber → Broadcast`) was **intentionally reduced** to a practical model:

```text
Account → Audience Group (consent scope) → Broadcast → Recipient
         └→ AccountSuppression (durable opt-out / bounce ledger)
```

This document tracks **legal/marketing compliance**, **Cloudflare platform limits**, and **implementation status**.

---

## Cloudflare & delivery risks (reference)

| Risk | Mitigation |
|------|------------|
| AUP / spam complaint rate on customer Worker or CRM domain | Suppression ledger, rate-limited dispatch, no send without auth |
| Worker subrequest / CPU limits on bulk send | Queue + batch dispatch (scheduler), not single-request fan-out |
| Open/click tracking write spikes on CRM store | Buffered/batched tracking writes in production (same tenant as `hq/crm`) |
| Open redirect abuse on `/crm/t/c` | Allow only `http:` / `https:` targets |
| Trust & Safety phishing via CRM domain | Same redirect guard + monitoring |

---

## Must-have (P0) — required before production send

| # | Item | Status |
|---|------|--------|
| 1 | **RFC 8058 one-click:** `List-Unsubscribe` + `List-Unsubscribe-Post` on outbound mail; GET = confirm page, POST = unsubscribe | Done (backend); Worker `/v1/send` must forward headers in prod |
| 2 | **Unsubscribe URLs exempt from click tracking** in `render.ts` | Done |
| 3 | **Click redirect guard** (`/crm/t/c`) — block non-http(s) schemes | Done |
| 4 | **Durable suppression:** group unsubscribe → `accountSuppressions` + sync/manual add respects ledger | Done (schema + migration); UI for ledger later |
| 5 | **Legal footer merge tags** in built-in templates (`{{organization_name}}`, `{{postal_address}}`, etc.) | Done (templates + `account.compliance`); **UI to edit compliance pending your review** |
| 6 | **CRM API auth** — public only: health, tracking, unsubscribe, assets; mutating routes require secret/session | Done (`CRM_API_SECRET`; dev skips if unset). Webhooks: `CRM_WEBHOOK_SECRET` |

---

## Nice-to-have (P1+) — after P0 + UI review

Production CRM is intended to run on **the customer’s own Cloudflare stack** (`hq/crm` beside their Worker), not a central Relaybase D1 catalog. Persistence may evolve from dev JSON to a tenant-local store; **no separate “D1 migration” track** is planned here.

| # | Item |
|---|------|
| 7 | Legacy spec banner + canonical `crm-audience-broadcast-model.md` | Done |
| 8 | Korea night-send guard (21:00–08:00 KST) — warn or block scheduled/immediate marketing sends |
| 9 | Consent audit fields surfaced in UI (`consentSource`, `consentedAt`) |
| 10 | DKIM/SPF domain verification banner before send |
| 11 | Optional per-broadcast “disable open/click tracking” (GDPR-sensitive lists) |
| 12 | Webhook HMAC for `/crm/webhooks/bounce` |
| 13 | Dedupe manual + synced contacts by email within a group at sync time |

---

## Store schema changes (2026-09-15)

See `hq/crm/src/db/types.ts`:

- `account.compliance` — organization name, postal address, contact email (CAN-SPAM / disclosure)
- `accountSuppressions.audienceGroupId` — `null` = account-wide; set = group-scoped unsubscribe
- `accountSuppressions.reason` includes `unsubscribe`
- `AudienceMember.consentSource` / `consentedAt` — audit trail (optional at import)

Migration runs on every `store.read()` via `normalizeStore()` and backfills suppressions from existing `sendStatus: unsubscribed` contacts.
