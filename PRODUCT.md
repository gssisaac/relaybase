# Relaybase — Product overview

**Tagline:** Product email on your Cloudflare account.

**One-liner:** Relaybase is a **Mac app** (Windows later) that wraps Cloudflare Email Sending and Routing with a Spark-like inbox and a send/receive API. The routing Worker installs into **your** Cloudflare account. **$39 one-time.** We do not host your mail.

**Website:** [relaybase.xyz](https://relaybase.xyz)

---

## Positioning (pivot)

Relaybase is **software**, not a hosted multi-tenant email intermediary. You connect your Cloudflare API token; we never ask you to point nameservers at Relaybase or place domains under our account.

See `docs/pivot-byo-cloudflare.md`.

---

## Who it's for

Solo builders and multi-product operators who already manage domains on Cloudflare and need `billing@`, `support@`, etc. without Google Workspace seat math — plus an API for automation.

---

## Pricing

| | Relaybase | Cloudflare Email Sending | Google Workspace (illustrative) |
|---|-----------|--------------------------|----------------------------------|
| **Price** | **$39 one-time** (app license) | ~$5/mo (your CF bill) | ~$7/user/mo × seats |
| **Infrastructure** | Worker in **your** account | Your account | Google |

---

## Core capabilities

- Mac app: inbox, compose, accounts, domains, metrics (same IA as prior `app/` dashboard)
- One-click install of `server/` Worker into the user's Cloudflare account
- Domain-scoped API keys, webhooks, inbound R2 storage — owned by the user
- Operator `admin/`: licenses, Worker health for Relaybase's own domain, release ops

---

## What Relaybase is not

- Not a hosted ESP that processes mail on a shared Cloudflare account
- Not a Cloudflare reseller
- Not a team Gmail replacement for humans who live in email all day
