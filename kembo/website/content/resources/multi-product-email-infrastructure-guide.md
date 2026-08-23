---
title: "The Multi-Product Email Infrastructure Guide: One Pattern, Every Domain"
navTitle: "Multi-product email guide"
description: "Running email for four products shouldn't mean four different setups. Here's the playbook for scaling product email without re-architecting every time you ship a new domain."
keyword: "multi-product email infrastructure"
order: 9
date: "2026-08-05"
image: "/images/resources/multi-product-email-infrastructure-guide-hero.webp"
imageAlt: "Four separate product domains connected to one shared email infrastructure pattern and dashboard"
---

The first product's email setup is always the easy one. You pick a provider, wire up `billing@` and `support@`, ship it, move on. The pain shows up on the second product — and gets worse on the third — because most teams don't realize they built something *specific to Product A* until they're staring at Product B's domain wondering whether to copy the setup, fork it, or start over.

If you're an agency running client domains, a platform team spinning up per-service addresses, or a founder who knows today's one product won't be the last one, the question worth answering early is: what does the *pattern* look like, not just the first instance of it.

## Why the first setup rarely generalizes

Most email setups get built reactively, solving exactly the problem in front of you: one domain, one Cloudflare token, one set of environment variables in one codebase. That's a completely reasonable way to ship Product A fast. It's also, by construction, not something that scales cleanly to Product B, because:

- The Cloudflare credential used for Product A can usually touch every domain in the account — copying it into Product B's environment is the path of least resistance, and it's also how credential sprawl starts (see [domain-scoped API keys for multi-product teams](/resources/domain-scoped-api-keys-multi-product))
- Whatever inbound parsing or webhook logic got hand-built for Product A lives in Product A's codebase, not somewhere reusable
- There's no shared dashboard — if you want to check send logs for Product B, you're reading a different Worker's console output than Product A's

None of this was a mistake. It's just what happens when infrastructure gets built to solve today's problem, and "today's problem" was one domain.

## The pattern that does generalize

The fix isn't a better first implementation — it's separating the **integration pattern** from the **domain instance**. Every product should use the exact same API shape (`POST /v1/send`, `/v1/inbox/events`, webhook registration) regardless of which domain it's running on. What changes per product is just the API key and the domain it's scoped to.

That's the whole idea: same code path, same client library, same webhook-handling logic, in every product's codebase — the only thing that differs between Product A and Product D is which key gets loaded from that service's environment variables.

## A concrete numbers comparison

An agency running four client products, each needing the standard six addresses, hits very different math depending on the model:

| | Per-domain flat pricing | Google Workspace-style seat pricing |
|---|---|---|
| Domains/products | 4 | 4 |
| Price per domain | $10/month | 6 seats × $7/month = $42/month |
| Total monthly | **$40/month** | **$168/month** |
| Setup per new domain | Verify domain, issue key | Verify domain, provision 6 seats, configure forwarding |

At one domain, the gap is $32/month — noticeable, not existential. At four domains, it's $128/month, or roughly **$1,536/year**, and the gap widens linearly with every product you ship. The seat-pricing model doesn't just cost more — it costs proportionally *more* the more successful your multi-product strategy is.

## What actually changes as you add products

With a consistent per-domain pattern, adding Product E to the portfolio looks like:

1. Verify the new domain on Cloudflare Email Sending (DNS records, standard verification)
2. Issue a new domain-scoped API key from the operator dashboard
3. Drop that key into Product E's environment
4. Reuse the exact same send/receive integration code already running in Products A through D

No new Worker to write, no new parsing logic, no new dashboard to check. The only genuinely new work is the domain verification step, which is inherent to owning a new domain regardless of what email infrastructure sits behind it.

## Where Relaybase fits

This is the model Relaybase is built around end to end: **$10/month per domain**, domain-scoped API keys, the same `fetch()`-based integration pattern across every product, and one operator dashboard showing send logs, inbound mail, and key issuance across the whole portfolio — not a separate view per domain. Platform teams issue one key per service; agencies issue one key per client domain; either way, growing from one product to ten doesn't require re-architecting anything.

## The takeaway

If you're only ever going to run one product's email, the infrastructure question barely matters — pick anything reasonable and move on. If a second or third domain is even plausible, it's worth setting up the pattern once, correctly, rather than discovering the cost of not doing so when Product C's launch gets delayed by a credential-sharing decision made for Product A.

See the credential-isolation half of this pattern in [domain-scoped API keys for multi-product teams](/resources/domain-scoped-api-keys-multi-product), and the seat-math case for why this beats Workspace at any scale in [Google Workspace vs. product email](/resources/google-workspace-vs-product-email). Ready to set the pattern up for your portfolio? [Join the Relaybase beta](/get-started).
