# Relaybase — Product overview

**Tagline:** Every product email. One flat price.

**One-liner:** Relaybase gives product teams every standard email address (`billing@`, `support@`, `privacy@`, and more) on their own domain — send transactional mail, receive inbound mail, and wire it into their stack with a simple API. **$10/month per domain.** Built on Cloudflare.

**Website:** [relaybase.com](https://relaybase.com)

---

## The problem

Every product needs a familiar set of email addresses. Customers expect invoices from `billing@`, help from `support@`, and privacy requests at `privacy@`. Founders and ops teams often solve this by:

- Buying **Google Workspace seats** for each role (six addresses ≈ six users ≈ **$42/month** at Business Starter)
- Using a **shared transactional provider** for send only, then juggling Gmail forwarding or Zapier for inbound
- **Embedding Cloudflare credentials** in every app and re-implementing routing, logs, and webhooks per product

The result is expensive seat math, credential sprawl, and email infrastructure that scales poorly when you ship a second or third product.

---

## The solution

Relaybase is **product email infrastructure** — not another inbox to check manually. One flat price per domain covers:

- All standard product addresses on **your brand's domain**
- **Transactional send** (receipts, resets, onboarding)
- **Inbound receive** (support tickets, privacy requests) via API poll or signed webhooks
- **One API key per domain** so each product stays isolated
- **Operator dashboard** for keys, logs, and monitoring
- **Customer dashboard** for inbox, compose, audience, and broadcasts

Builders integrate with `fetch()` in minutes. Marketers get predictable pricing and a story that resonates with indie founders and multi-product teams alike.

---

## Who it's for

### Solo product builders

Launch `billing@` and `support@` on day one without paying for six Google seats you'll never log into.

**Example:** Indie SaaS founder sends invoices from `billing@` and routes support tickets to their app via webhook — **$10/month total**.

### Multi-product managers

Run separate domains per product with the same API pattern. Scale from one product to five without re-architecting email.

**Example:** Agency ships four client products: 4 domains × $10 = **$40/month** vs **~$168/month** on Google Workspace for comparable address coverage.

### Platform and ops teams

Centralize transactional send and inbound routing. Domain-scoped API keys keep each microservice or product isolated.

**Example:** Platform team issues one key per service domain; `admin@` alerts flow to PagerDuty via webhook.

---

## Standard addresses (included per domain)

Relaybase is designed around the addresses every product is expected to have:

| Address | Typical use |
|---------|-------------|
| `billing@` | Invoices, receipts, payment updates |
| `support@` | Customer help and ticket intake |
| `privacy@` | GDPR requests and data inquiries |
| `noreply@` | Password resets and system notifications |
| `hello@` | Welcome emails and onboarding |
| `admin@` | Internal alerts and ops notices |

Customers see **yourbrand.com** in the From field — not a shared relay domain.

---

## Core capabilities

### Transactional send

Send from any address on the verified domain. JSON API with plain text and optional HTML. Display names (`fromName`) so receipts show "Your App" instead of "billing".

### Inbound receive

Mail to routed addresses lands in Relaybase storage. Apps can:

- **Poll** lightweight events (`inbound.email.received`) and fetch full bodies on demand
- **Push** via **signed webhooks** (HMAC verification, Stripe-style) into n8n, Zapier, or custom handlers

No Gmail forwarding chains. Routing is configured through Cloudflare Email Routing → Worker.

### Domain-scoped API keys

Each key is bound to exactly one sending domain. The `from` address on every send must match that domain. One key can power `billing@` and `support@` on the same domain — no credential sprawl across repos.

### Multi-product ready

Product A on `producta.com`, Product B on `productb.com`: same dashboard, same integration pattern, separate keys and isolation.

### Send logs and monitoring

Every send attempt is logged (success and failure). Operators filter by domain, status, and time window for ops visibility.

### Dashboards

- **Operator (admin):** Platform health, key issuance, send logs, inbound mail, user accounts, Cloudflare connection
- **Customer (app):** Inbox, sent mail, compose, sender accounts, audience, broadcasts, domain setup, API keys, metrics

---

## Pricing

| | Relaybase | Google Workspace (illustrative) |
|---|-----------|----------------------------------|
| **Price** | **$10/month per domain** | ~$7/user/month (Business Starter) |
| **Six standard addresses** | Included on one domain | Often modeled as 6 users ≈ **$42/month** |
| **Transactional send** | Included | Not included (need separate tool) |
| **Inbound API / webhooks** | Included | Forwarding + glue code |
| **Per-seat fees** | None | Per user |
| **Multi-product** | $10 × domains | Scales with seats per product |

**Positioning:** The cheapest predictable way to run **product email** — not a replacement for a full company mailbox for humans who read email all day, but the right fit for **API-driven product addresses**.

---

## Competitive angles

| vs. | Relaybase wins when… |
|-----|----------------------|
| **Google Workspace** | You need addresses for the *product*, not humans. Flat domain pricing beats seat math. |
| **SendGrid / Resend / Postmark** | You need **send + receive** on the same domain with one vendor and one key model. |
| **DIY Cloudflare** | You want keys, logs, webhooks, and dashboards without embedding CF tokens in every service. |
| **Shared freemail / relay domains** | Brand matters — customers should see `@yourdomain.com`. |

---

## Key messages (copy bank)

- **Headline:** Every standard product email. One flat $10/month.
- **Subhead:** Spin up billing, support, privacy, no-reply, hello, and admin addresses for every product you ship — send and receive with a few lines of code.
- **Builder hook:** Embed in minutes with `fetch()` — send and receive, poll or webhook.
- **Ops hook:** Domain-scoped keys, send logs, inbound events — infrastructure, not another inbox.
- **Trust:** Built on Cloudflare Email Sending and Email Routing — enterprise-grade delivery without enterprise-grade complexity.
- **Multi-product:** One domain per product, same API pattern, same dashboard.

---

## Integration story (for technical buyers)

1. Verify domain on Cloudflare Email Sending.
2. Issue a domain API key (operator dashboard or admin API).
3. **Send:** `POST /v1/send` with Bearer key.
4. **Receive:** Register webhook or poll `/v1/inbox/events`, then fetch `/v1/inbox/messages/:id`.
5. Wire into tickets, Slack, CRM, or automation — no manual inbox required.

Webhook deliveries include `X-Relaybase-Signature` for verification. Events carry preview text, attachment flags, and metadata for filtering before full fetch.

---

## What Relaybase is not

- **Not a team email client** — no replacement for Gmail/Outlook for daily human mail.
- **Not unlimited marketing email at scale** — positioned for **product** transactional and operational mail; broadcast features exist in the customer dashboard but the core story is infrastructure for standard addresses.
- **Not a DNS registrar** — domains are onboarded on Cloudflare (customer's zone or transfer).

Being clear on scope builds trust with technical buyers and avoids support mismatch.

---

## Brand and voice

- **Audience:** Builders, founders, product managers, platform engineers — people who *ship*.
- **Tone:** Direct, confident, anti-bloat. "Everything a product team needs — nothing you don't."
- **Avoid:** Enterprise jargon, "revolutionary," vague "AI-powered" claims.
- **Emphasize:** Flat pricing, standard addresses, code-first, multi-product, Cloudflare-backed.

---

## Assets and references

| Asset | Location |
|-------|----------|
| Marketing site | `website/` — hero, features, pricing comparison, use cases, code embed |
| Site config (pricing, addresses, SEO) | `website/src/lib/site-config.ts` |
| Developer docs | `README.md` |
| Operator diagnostics | `scripts/diagnose-relaybase.mjs` |

---

## FAQ (marketing)

**Why per domain, not per email?**  
Product addresses (`billing@`, `support@`, …) share one domain and one integration. Per-seat pricing punishes the normal setup.

**Can I run multiple products?**  
Yes. Each product domain is $10/month with its own API key and isolation.

**Do recipients see Relaybase?**  
No. Mail is sent from your verified domain with your display names.

**How does inbound work?**  
Cloudflare routes mail to Relaybase; your app gets events via webhook or polling. Full bodies are fetched over the API when you need them.

**Is it only for Cloudflare customers?**  
Relaybase runs on Cloudflare infrastructure. Domain onboarding uses Cloudflare Email Sending and Routing — technical buyers should expect CF DNS/zone setup.
