---
title: "Transactional Email: Send and Receive on One Domain, One API"
navTitle: "Transactional send and receive"
description: "Most transactional email APIs only send. Here's why receiving matters just as much for product addresses, and how poll and webhook models work in practice."
keyword: "transactional email API inbound"
order: 3
date: "2026-08-05"
image: "/images/resources/transactional-email-send-and-receive-hero.webp"
imageAlt: "Two arrows on a domain icon, one pointing out for send and one pointing in for receive"
---

Ask most developers what "transactional email" means and you'll get half the picture: password resets, receipts, order confirmations — mail your app sends out. That half is well-served. SendGrid, Postmark, Resend, and a dozen others do outbound transactional mail well, with clean APIs and solid deliverability.

The half nobody's API covers as cleanly is what happens when someone replies. A customer disputes a charge on the receipt you just sent from `billing@`. Support tickets come in to `support@`. A GDPR request lands in `privacy@`. Your product address just became a two-way conversation, and most transactional providers stop at the door — they'll help you send the receipt, but receiving the reply is your problem.

## Why "send-only" becomes a real gap

It's easy to underestimate this gap early, because most of your product's mail really is one-directional at first: a signup confirmation, a password reset link, a receipt. Send-only covers that fine. The gap shows up the moment a real customer relationship starts — and it always does, eventually — because customers reply to email the same way they always have, regardless of what your product's architecture assumes.

At that point you're improvising: Gmail forwarding rules bolted onto a domain that's otherwise fully automated, a second vendor for inbound-only, or Cloudflare Email Routing wired up by hand with no logs, no webhook signing, and no dashboard to see what came in.

## What "receive" actually needs to do

Inbound product email isn't about hosting a mailbox. Nobody's expected to open a webmail client and read `support@` like a person reading Gmail. It needs to turn incoming mail into a **signal your system can act on**:

- A lightweight event the moment mail arrives (`inbound.email.received`), so you can react fast without pulling a full body
- The ability to **fetch the full message** on demand — subject, body, attachments — once you've decided it matters
- A way to **push** that signal instead of polling, for systems that want mail to show up in a ticket queue, Slack channel, or CRM without a cron job checking in

That's the shape of a webhook-and-poll model, and it's a fundamentally different design than "give this address an inbox."

## Poll vs. webhook: two ways to consume inbound mail

**Polling** works well when your system already runs on a schedule, or when you want full control over retry and backoff logic. You hit `/v1/inbox/events` periodically, get back new mail events since your last check, and fetch full messages for the ones you care about. Simple, stateless, easy to test manually.

**Webhooks** work better when you want mail to trigger something immediately — a new ticket appearing in your helpdesk the second a customer emails `support@`, or a Slack ping the moment `admin@` gets an alert from your hosting provider. A signed webhook (HMAC-verified, the same pattern Stripe uses) pushes an event to your endpoint as soon as mail lands, with preview text and attachment flags included so you can filter before deciding to fetch the full body.

Most real integrations end up using both: webhooks for the fast path, polling as a fallback in case a webhook delivery gets missed.

## A concrete flow

Say a customer replies to a receipt sent from `billing@`, asking why they were charged twice. Here's what the receive side actually does:

1. Cloudflare Email Routing (the underlying delivery layer) receives the mail on your verified domain and routes it to the inbound handler.
2. An `inbound.email.received` event fires — either delivered to your registered webhook or queued for the next poll.
3. Your system sees the event, checks the sender and subject, and decides this looks like a billing dispute.
4. It calls `/v1/inbox/messages/:id` to fetch the full body, then creates a ticket or pings your billing channel — automatically, with no one manually checking a `billing@` inbox.

No Gmail forwarding chain, no manual mailbox, and no separate vendor stitched in just to cover the inbound half of a `billing@` address that was already sending mail through a different tool.

## Where Relaybase fits

This send-and-receive pairing is the core of what Relaybase does: one domain-scoped API key, `POST /v1/send` for outbound, and `/v1/inbox/events` plus signed webhooks for inbound — all on your own verified domain, all for **$10/month per domain**. Built on Cloudflare Email Sending and Email Routing, so you get enterprise-grade delivery without wiring the underlying infrastructure together yourself.

## The takeaway

If your product address only ever sends, a send-only API is fine. The moment a human might reply — and for `billing@`, `support@`, or `privacy@`, they eventually will — you need the receive half too, and bolting it on after the fact with forwarding rules is worse than designing for it from day one.

See how domain-scoped keys keep this isolated per product in [domain-scoped API keys for multi-product teams](/resources/domain-scoped-api-keys-multi-product), or how the underlying routing layer works in [Cloudflare Email Routing for developers](/resources/cloudflare-email-routing-for-developers). Ready to wire up both directions on your own domain? [Join the Relaybase waitlist](/get-started).
