---
title: "Why Relaybase Stores Mail in Your Cloudflare R2 Bucket (And What It Costs)"
navTitle: "Why R2 for email storage"
description: "Why Relaybase requires Cloudflare R2 for mailbox storage, how the zero-egress R2 object tree works, how the 10 GB free tier applies, and why Cloudflare asks for a payment method."
keyword: "Cloudflare R2 email storage Relaybase"
order: 12
date: "2026-09-02"
image: "/images/how-it-works/r2-object-tree.png"
imageAlt: "Infographic of the relaybase-mailbox R2 tree showing inbound and sent prefixes, thin meta.json files, and raw MIME storage"
---

When setting up Relaybase, one of the first prompts you see is a check ensuring Cloudflare R2 is enabled on your Cloudflare account. If you're coming from traditional email providers like Google Workspace or transactional send APIs like Resend, that requirement might look unexpected: *Why does an email client and API need S3-compatible object storage? And why does Cloudflare prompt for a payment method if R2 has a free tier?*

The short answer is data sovereignty and cost: Relaybase is not a hosted email relay. The mailbox lives directly in **your** Cloudflare account, and Cloudflare R2 is where your raw emails and attachments reside.

## Why not a central Relaybase mail server?

Traditional hosted email services store all your inbound customer inquiries, invoices, password resets, and attachments on their multi-tenant servers. If that service experiences an outage, changes its pricing, or shuts down, your data is locked in their infrastructure.

Relaybase works on a "Bring Your Own Cloudflare" architecture:

- When you install Relaybase, it deploys a Worker (`relaybase-api`), an R2 bucket (`relaybase-mailbox`), and three D1 SQLite databases directly into **your** Cloudflare account.
- Inbound mail delivered via Cloudflare Email Routing is parsed and written directly into your R2 bucket by your Worker.
- Outbound transactional sends and compose messages write their originals into that same bucket.
- **Relaybase never hosts, reads, or proxies your email.** If our website or servers were completely offline, your email infrastructure would continue receiving, sending, and indexing mail without a hiccup.

## How Relaybase structures email in R2

In your Cloudflare account, the `relaybase-mailbox` R2 bucket acts as the immutable source of truth for every email across all your domains.

![Infographic of the relaybase-mailbox R2 object tree](/images/how-it-works/r2-object-tree.png)

Each email is stored in a clean, domain-isolated directory structure:

```text
relaybase-mailbox/
  inbound/{domain}/{id}/
    meta.json            # Thin metadata: sender, recipients, subject, 500-char preview, attachments list
    raw.eml              # Full, uncompressed MIME stream of the original message
    attachments/{aid}-{name} # Stored separately for efficient streaming
  inbound/{domain}/by-message-id/{encodedMessageId}  # O(1) pointer for duplicate detection

  sent/{domain}/{id}/
    meta.json
    raw.eml
    attachments/{aid}-{name}
  sent/{domain}/by-message-id/{encodedMessageId}

  sent/_sendlog/{uuid}.json  # Immutable audit log for transactional & broadcast sends
```

### Why thin `meta.json` + `raw.eml`?

Email bodies can be large, especially when formatted with complex HTML, inline images, or multiple MIME parts. If opening an inbox required loading every raw message body over the network, list scrolling would quickly become sluggish.

Relaybase solves this with a two-tier storage layout:

1. **Thin `meta.json`**: Contains headers, timestamps, read status, attachment metadata, and a lightweight `bodyPreview` (up to 500 characters). This allows the desktop app and API to scroll and filter mail without downloading heavy payloads.
2. **`raw.eml`**: When you click to open an email or request the full message via API, your Worker reads `raw.eml` and parses the full text, HTML, and MIME structures on demand.

## D1 index + R2 originals: the best of both worlds

A common question is why Relaybase uses both Cloudflare D1 (serverless SQLite) and Cloudflare R2:

- **Cloudflare D1 (`relaybase-mail`)**: Provides instant SQL queries, mailbox counts, and full-text search (`mailbox_fts`) over subjects, senders, and body snippets.
- **Cloudflare R2 (`relaybase-mailbox`)**: Holds the authoritative original files and attachments.

Because R2 is the source of truth, the D1 search and list database is completely rebuildable. If you ever migrate databases or want a clean index, running `POST /console/rebuild-mail` crawls your R2 bucket and recreates the D1 search indexes automatically.

## R2 economics: zero egress fees & 10 GB free tier

For file and email storage, Cloudflare R2 has two massive structural advantages over AWS S3 or Google Cloud Storage:

### 1. $0 egress fees (always)

Traditional cloud storage providers charge significant data transfer (egress) fees whenever you download files or sync attachments. If you open your inbox from multiple devices or fetch attachments via API, S3 bills you for every gigabyte transferred. Cloudflare R2 has **zero data egress fees**, making bandwidth completely free regardless of how often you read or download emails.

### 2. 10 GB free storage every month

Cloudflare provides a generous free tier for R2 every month:

- **10 GB / month** of storage included at $0
- **1,000,000 Class A operations** (creates, writes, lists) per month included at $0
- **10,000,000 Class B operations** (reads) per month included at $0

For the vast majority of startups, SaaS projects, and indie developers, 10 GB represents hundreds of thousands of standard transactional emails and customer conversations. Your monthly storage bill on Cloudflare will literally be **$0.00**.

Even if your product grows and exceeds 10 GB, Cloudflare R2 is only **$0.015 per GB-month** ($1.50 per 100 GB), with zero egress charges.

## Why Cloudflare prompts for a payment method

If R2 includes 10 GB for free, why does Cloudflare require a payment method to activate it?

Cloudflare's platform policy requires a verified billing profile on file before provisioning object storage resources. This is standard fraud prevention to deter abusive bot accounts from creating free storage buckets.

Additionally:
- If your Cloudflare account has never created an R2 bucket before, R2 may be in an uninitialized state.
- If an account created an unused $0 R2 subscription in the past, Cloudflare sometimes automatically removes the inactive subscription after several days.

When Relaybase checks your account and detects that R2 is not active, it returns error code `10042` (`R2_SUBSCRIPTION_REQUIRED`). Opening the Cloudflare Dashboard and enabling R2 (with a payment method on file) immediately restores the $0 R2 subscription, allowing Relaybase to create `relaybase-mailbox` and deploy your Worker.

> **Note on activation delay:** After you add a payment method or enable R2 in the Cloudflare dashboard, it typically takes **1 to 2 minutes** for Cloudflare's billing system to synchronize and propagate the active subscription status to its API. If an immediate install check returns `10042`, wait a moment and try again.

## Summary

Relaybase uses Cloudflare R2 because your email belongs to you. By combining R2's zero-egress economics and 10 GB free tier with D1's fast search indexing, you get enterprise-grade email infrastructure running directly inside your own cloud account for essentially zero monthly storage cost.

To explore how the rest of the stack works, see [Cloudflare Email Routing for developers](/resources/cloudflare-email-routing-for-developers), [transactional email: send and receive on one domain](/resources/transactional-email-send-and-receive), or [why we built Relaybase](/resources/why-we-built-relaybase). If you're ready to set up your own mailbox, [join the Relaybase beta](/get-started).
