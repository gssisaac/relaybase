---
title: "Domain-Scoped API Keys: Why Email Credentials Shouldn't Cross Products"
navTitle: "Domain-scoped API keys"
description: "One Cloudflare token shared across every service is a credential-sprawl problem waiting to happen. Here's why binding email keys to a single domain fixes it."
keyword: "multi-product email API keys"
order: 6
date: "2026-08-05"
image: "/images/resources/domain-scoped-api-keys-multi-product-hero.webp"
imageAlt: "Three separate domains each with their own isolated API key, instead of one shared key across all three"
---

Here's a pattern that starts innocently and turns into a real liability: a team spins up email sending for Product A using a Cloudflare API token, it works, and six months later that same token is copy-pasted into Product B's environment variables because it was already there and "it's just email." By Product C, three separate codebases hold a credential that can send mail as *any* address on *any* domain in the account — and nobody remembers exactly which services still have it.

That's credential sprawl, and it's the default outcome of treating email infrastructure as something you configure once and reuse everywhere.

## Why shared credentials are worse than they look

A single shared token isn't just a security smell — it actively breaks the things you'd want from real infrastructure:

- **No isolation.** If Product B's environment gets compromised, whoever has that token can now send mail as Product A's `billing@` too. The blast radius of one leaked credential is every domain it can touch, not just the one that leaked it.
- **No clean revocation.** If you need to rotate the credential because one service is being decommissioned, you have to coordinate the rotation across every other service still using the same token — or leave it live longer than you should to avoid breaking things.
- **No accountability.** When a send failure or a suspicious pattern shows up in the logs, a shared token can't tell you *which* product generated it. Every incident starts with "which of our five services was this."

None of this is a hypothetical. It's the natural failure mode of "one token, many consumers," and it shows up in every kind of shared infrastructure — API keys, database credentials, cloud provider tokens — not just email.

## What domain-scoped keys fix

The fix is structural, not procedural: bind each key to exactly one sending domain, and enforce that the `from` address on every send matches that domain. Product A's key can send as anything `@producta.com`. It cannot send as `@productb.com`, full stop, because the platform checks the domain on every request — not because someone remembered to configure a permission correctly.

That single constraint solves all three problems above:

- **Isolation** is structural — a leaked key for one domain has zero reach into any other domain, by design, not by convention.
- **Revocation** is scoped — rotating Product A's key only affects Product A, because nothing else was ever using it.
- **Accountability** is automatic — every send log entry is tied to the domain-scoped key that made it, so "which product sent this" is answered by the log line itself.

## One key can still cover multiple addresses

Domain-scoped doesn't mean address-scoped. A single key for `producta.com` can send from `billing@producta.com` *and* `support@producta.com` — the isolation boundary is the domain, not each individual address, because that's the actual trust boundary that matters. You don't need six keys per product just because you have six addresses; you need one key per product, because that's the unit that should be isolated from every other product.

## A concrete setup

A platform team running three client products might issue:

- One API key bound to `clienta.com`, used only inside Client A's service
- One API key bound to `clientb.com`, used only inside Client B's service
- One API key bound to `clientc.com`, used only inside Client C's service

If Client A's service gets compromised tomorrow, the blast radius is Client A's domain. Client B and Client C's email infrastructure is untouched, because their credentials were never in the same place, and the platform enforced that separation on every API call — not just at token-creation time.

## Where Relaybase fits

This is the credential model Relaybase is built around: every API key is scoped to exactly one sending domain, verified through Cloudflare Email Sending, with the `from` address checked against that domain on every send. One key per product, same integration pattern (`fetch()` with a Bearer token) whether you're running one domain or fifty. Operators issue keys from the admin dashboard, see send logs filtered per domain, and rotate one product's credential without touching any other.

## The takeaway

Shared credentials feel efficient right up until the moment they're the reason an incident is worse than it needed to be. If you're running more than one product — or expect to — binding email API keys to a single domain from day one costs nothing extra and removes an entire category of blast-radius risk later.

See how this scales across a whole portfolio of products in [the multi-product email infrastructure guide](/resources/multi-product-email-infrastructure-guide), or how inbound mail flows through the same domain-scoped model in [inbound email webhooks for support tickets](/resources/inbound-email-webhooks-support-tickets). To issue your first domain-scoped key, [join the Relaybase waitlist](/get-started).
