---
title: "Cloudflare Email Routing for Developers: What It Does, and Where It Stops"
navTitle: "Cloudflare Email Routing for developers"
description: "Cloudflare Email Routing gets inbound mail to a Worker for free. Here's exactly what it hands you, what it doesn't, and what it takes to turn that into a real API."
keyword: "Cloudflare Email Routing API"
order: 5
date: "2026-08-05"
image: "/images/resources/cloudflare-email-routing-for-developers-hero.webp"
imageAlt: "Diagram showing mail flowing from Cloudflare Email Routing into a Worker, then out to logs, keys, and a dashboard"
---

Cloudflare Email Routing is a genuinely great primitive, and it's free. Point your domain's MX records at Cloudflare, define a routing rule, and inbound mail to any address gets forwarded to another mailbox or handed to a Worker as a raw message stream. If you're a developer comfortable wiring infrastructure by hand, this is one of the better-kept secrets in the email space — you get inbound mail *and* the ability to run code against it, without a per-message fee.

The part that doesn't get mentioned as often: a Worker receiving a raw email stream is not the same thing as an API your product can actually build against.

## What Email Routing hands you

When mail arrives at a routed address, Cloudflare calls your Worker's `email()` handler with the raw MIME message as a stream. That's it. No parsed JSON, no attachment extraction, no dedupe logic, no persistence — you get bytes and a callback, and everything from there is your responsibility to build.

Combined with Cloudflare Email Sending (or a routed SMTP relay) for outbound, you technically have everything you need to build product email infrastructure. "Technically" is the operative word.

## What you have to build yourself

To turn that raw Worker callback into something a real product can rely on, you need to build, test, and maintain:

- **MIME parsing** — extracting subject, body (text and HTML), headers, and attachments from a raw stream, correctly, across the many ways real-world email clients format messages
- **Storage** — somewhere to persist inbound messages so "fetch this message by ID later" is possible, not just "react to it the instant it arrives or lose it"
- **Event/webhook delivery** — a system to notify your app that mail arrived, with retry logic if your endpoint is down, and HMAC signing so you're not accepting spoofed webhook calls
- **API keys and isolation** — some way to scope access per domain or per product, instead of embedding a raw Cloudflare account token in every service that needs to touch mail
- **Logs and observability** — a way to see what was sent, what bounced, and what came in, without SSHing into a Worker's console logs
- **A dashboard** — for anyone non-technical on the team who needs to see what's happening with `support@` without reading your Worker code

None of that is exotic engineering. All of it is real engineering — the kind that's easy to underestimate until you're three months into "just a quick Cloudflare Worker" and maintaining a small internal email platform nobody signed up to own.

## The DIY cost that doesn't show up on a pricing page

This is the part that's easy to miss when comparing "free Cloudflare Routing" against a paid product: the cost isn't the Cloudflare bill, which is genuinely near-zero. The cost is the engineering time spent building and maintaining MIME parsing, retry-safe webhooks, and a credential model — plus the ongoing cost of being the person who understands that system when it breaks at 2am because a client sent an email with a formatting quirk your parser didn't handle.

For a single internal tool, that trade might be fine. For product infrastructure that customer-facing addresses depend on, it's a maintenance burden most teams didn't intend to take on.

## Where Relaybase fits

Relaybase is built directly on Cloudflare Email Sending and Email Routing — same underlying delivery network, same free-tier economics on the infrastructure layer — with the parsing, storage, webhook signing, domain-scoped keys, logs, and dashboard already built. You verify your domain, get an API key scoped to it, and call `/v1/send` or register a webhook for `/v1/inbox/events`. The Worker `email()` handler, the MIME parser, and the retry logic are already written and running.

That's the actual trade-off: build it yourself on Cloudflare's free primitives and own the maintenance, or use the same primitives through an API that's already handled the parsing and plumbing, for **$10/month per domain**.

## When DIY is still the right call

If you're comfortable owning infrastructure, have exactly one domain to route, and don't need multi-product isolation or a non-technical dashboard, raw Cloudflare Email Routing plus a Worker is a legitimate, low-cost path — especially if you already have Workers experience on the team. This isn't an argument that DIY is wrong. It's an argument that the "free" comparison is incomplete without counting engineering time.

## The takeaway

Cloudflare Email Routing solves the hard infrastructure problem — reliable inbound delivery — for free. It doesn't solve the API problem: parsing, persistence, signed webhooks, key scoping, and a dashboard. Those are what turn a Worker callback into something your product team can actually build on.

See how the resulting API model works end to end in [transactional email: send and receive on one domain](/resources/transactional-email-send-and-receive), or how domain-scoped keys keep multiple products isolated on the same underlying infrastructure in [domain-scoped API keys for multi-product teams](/resources/domain-scoped-api-keys-multi-product). If you'd rather skip building the parser, [join the Relaybase beta](/get-started).
