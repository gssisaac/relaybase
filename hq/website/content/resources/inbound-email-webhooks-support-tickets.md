---
title: "Inbound Email Webhooks: Turning support@ Replies Into Tickets Automatically"
navTitle: "Inbound email webhooks"
description: "How signed inbound email webhooks turn a support@ reply into a ticket, Slack ping, or CRM record automatically — without a Gmail forwarding chain in the middle."
keyword: "inbound email webhook support tickets"
order: 7
date: "2026-08-05"
image: "/images/resources/inbound-email-webhooks-support-tickets-hero.webp"
imageAlt: "An email arriving at support@ and a signed webhook firing to a helpdesk, Slack, and a CRM"
---

Somewhere in most support workflows, there's a step nobody's proud of: a human checking a `support@` Gmail inbox, manually copying the contents into a ticketing tool, and hoping nothing sits unread over a weekend. It's not that teams don't know better — it's that wiring `support@` directly into a helpdesk without a mailbox in the middle has historically required custom Cloudflare Worker code, an inbound-parsing service, or accepting a shared relay domain that isn't your brand.

Signed inbound webhooks close that gap the same way Stripe closed it for payments: mail happens, a verified event fires to your endpoint, your system reacts, no human has to be the router.

## Why the Gmail-forwarding pattern breaks down

Forwarding `support@` to a Gmail inbox and then rigging Zapier or a Gmail filter to push into a ticketing tool works, technically, for a while. It breaks down in predictable ways:

- **Latency and reliability drift** as filters, forwarding rules, and third-party automations stack up over time, each one a separate point of failure
- **No verification** — anything that lands in that inbox is trusted by whatever consumes it next, with no signature check on whether the "event" is real
- **No visibility** into what actually arrived versus what the automation successfully processed — a silently failed Zapier step looks identical to "no new support email today"
- **Brand mismatch** if the forwarding destination or automation tool ever surfaces its own address to a customer by accident

None of these are exotic failures. They're the normal decay of a system built from chained consumer tools instead of a single, verifiable event pipeline.

## What a signed webhook actually guarantees

A properly signed inbound webhook (HMAC-verified, the same pattern used for Stripe events) gives you three things a forwarding chain can't:

1. **Authenticity** — your endpoint can verify the `X-Signature` header against a shared secret before trusting the payload, so a spoofed request to your webhook URL gets rejected instead of silently creating a fake ticket
2. **A structured payload** — preview text, sender, attachment flags, and metadata arrive as JSON, not a raw MIME blob your code has to parse
3. **A deliberate fetch step** — the webhook tells you mail arrived and gives you enough to filter on; you decide whether it's worth pulling the full body, instead of every piece of inbound mail forcing a full parse

That third point matters more than it looks. Not every inbound email needs full processing — a lot of `support@` traffic is auto-replies, out-of-office bounces, or spam that slipped through. A lightweight event lets your system filter cheaply before doing the more expensive work of fetching and acting on a full message.

## A concrete flow: reply to a receipt becomes a ticket

1. A customer replies to a receipt sent from `billing@yourdomain.com`, disputing a charge.
2. Cloudflare Email Routing delivers the mail to your Relaybase inbound handler.
3. A signed `inbound.email.received` webhook fires to your registered endpoint within seconds, carrying sender, subject, and a preview.
4. Your endpoint verifies the signature, sees "billing dispute" in the preview, and calls `/v1/inbox/messages/:id` to fetch the full body.
5. It creates a ticket in your helpdesk (or posts to a `#billing-alerts` Slack channel) — automatically, with the original message attached.

No human checked an inbox to make step 5 happen. The address still behaves the way customers expect — they emailed `billing@yourdomain.com` and got a response — but nothing about the internal handling required a person to be the router.

## Webhook or poll — and when to use each

Webhooks are the right default when you want near-real-time reaction: tickets, Slack alerts, anything time-sensitive. Polling `/v1/inbox/events` is the better fit when your consuming system already runs on a schedule, or as a fallback path in case a webhook delivery gets missed — most production integrations end up using both, webhook for speed and poll as a safety net.

## Where Relaybase fits

Relaybase's inbound model is built around exactly this pattern: register a webhook endpoint, get HMAC-signed events the moment mail lands on any routed address on your domain, and fetch full message bodies on demand via `/v1/inbox/messages/:id`. Same domain-scoped API key that handles outbound send. No forwarding chains, no third mailbox in the middle.

## The takeaway

A `support@` or `billing@` address that silently drops replies into an unread inbox is worse than not having the address at all, because the customer assumes they were heard. Signed webhooks turn "someone has to check the inbox" into "the ticket already exists by the time anyone looks" — which is the actual bar customers expect from a product address in 2026.

For the full send-and-receive picture, see [transactional email: send and receive on one domain](/resources/transactional-email-send-and-receive). For how this stays isolated per product, see [domain-scoped API keys for multi-product teams](/resources/domain-scoped-api-keys-multi-product). To wire your first webhook, [join the Relaybase beta](/get-started).
