---
title: "The Open Source Cloudflare Email Worker: How Relaybase Runs in Your Account"
navTitle: "Open source Worker for Cloudflare"
description: "Why Relaybase open-sourced its Cloudflare Worker backend (strum-us/relaybase-worker), how the zero-data-custody architecture works, and how to inspect, deploy, and audit the code in your own account."
keyword: "Open source Cloudflare Worker email Relaybase"
order: 13
date: "2026-09-03"
image: "/images/resources/open-source-cloudflare-worker.png"
imageAlt: "Architecture diagram of the open source Relaybase Cloudflare Worker handling inbound MIME streams, D1 SQLite indexing, R2 storage, and outbound email sending"
---

When building email infrastructure for modern SaaS products, developer teams face a fundamental trust dilemma: *Do you hand your company's transactional emails, customer support threads, password resets, and invoices to a third-party multi-tenant relay, or do you spend months building and maintaining your own custom mail servers?*

Relaybase chose a third path: **Bring Your Own Cloudflare (BYO-CF)** with a 100% open-source backend Worker.

The entire backend that processes, indexes, parses, and sends email in Relaybase is published openly on GitHub at [**github.com/strum-us/relaybase-worker**](https://github.com/strum-us/relaybase-worker). It deploys directly into your personal or organization's Cloudflare account as a Cloudflare Worker (`relaybase-api`).

Here is a deep look into how the open-source Worker works, how zero-data-custody is enforced at the edge, and how the storage architecture keeps your email completely under your own control.

## Why Open Source the Worker?

In traditional hosted email services, every message your users receive or send passes through shared cloud servers owned by a third-party vendor. Even if that vendor promises data privacy, their infrastructure holds custody of your raw communications. If their servers go down, change terms, or suffer a security breach, your product email is directly compromised.

By open-sourcing the [**relaybase-worker**](https://github.com/strum-us/relaybase-worker) repository, we eliminate that risk entirely:

1. **Zero Data Custody**: Relaybase operates no central email proxy. Your emails never touch Relaybase servers.
2. **Complete Transparency**: You can inspect every line of TypeScript, every database query, and every cryptographic check before running it.
3. **Zero Vendor Lock-in**: All raw MIME emails (`raw.eml`), attachments, and metadata stay inside your Cloudflare R2 bucket and D1 SQLite databases. Even if Relaybase disappeared tomorrow, your email infrastructure would continue running seamlessly on Cloudflare.
4. **Auditability**: Security teams can verify exactly how API keys are scoped, how owner passtokens are hashed with `AUTH_PEPPER`, and how webhooks are signed.

---

## The Worker Architecture

The open-source Worker acts as the central hub connecting Cloudflare's serverless primitives: **Cloudflare Workers**, **Cloudflare Email Routing**, **Cloudflare Email Sending**, **Cloudflare R2**, and **Cloudflare D1**.

![Architecture of the open-source Relaybase Worker inside your Cloudflare account: inbound mail through Email Routing into relaybase-api, then R2 Mailbox, D1 DB, and D1 Mail; outbound send through Email Sending with DKIM and SPF](/images/resources/worker-architecture.png)

### 1. Inbound Email Pipeline: MIME Parsing & R2 Storage

When an email arrives at `billing@yourdomain.com` or `support@yourdomain.com`, Cloudflare Email Routing invokes the Worker's `email()` event handler with the raw MIME stream:

```typescript
export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    // 1. Parse raw MIME stream into headers, parts, and attachments
    const parsed = await parseRawMime(message.raw);

    // 2. Write immutable raw.eml and thin meta.json to your R2 bucket
    const messageId = generateMessageId();
    await storeInboundR2(env.INBOUND, message.to, messageId, parsed, message.raw);

    // 3. Index subject, sender, and text snippet in Cloudflare D1 for fast FTS5 search
    await indexMessageInD1(env.RELAYBASE_MAIL, message.to, messageId, parsed);

    // 4. Dispatch signed HMAC webhooks to your external endpoints
    ctx.waitUntil(dispatchInboundWebhooks(env.RELAYBASE_DB, message.to, messageId, parsed));
  }
}
```

- **R2 Object Tree**: Inbound mail is written to `inbound/{domain}/{id}/` containing `meta.json` (lightweight envelope preview) and `raw.eml` (uncompressed MIME bytes). Attachments are stored separately under `attachments/{id}-{filename}` for on-demand streaming.
- **Fast Search Indexing**: The Worker extracts a 500-character clean preview and indexes the metadata into the `mailbox_messages` table and `mailbox_fts` SQLite FTS5 table in Cloudflare D1 (`RELAYBASE_MAIL`).

### 2. Outbound Send Pipeline: DKIM Verification & Audit Logging

When sending an email via the desktop client or the REST API (`POST /v1/send`), the Worker enforces domain authentication:

- **DKIM & SPF Validation**: The Worker connects directly to Cloudflare Email Sending under your account credentials.
- **Domain Key Enforcement**: The Worker verifies that the Bearer API key used in the request is explicitly authorized to send on behalf of the `from` domain. If an API key issued for `producta.com` attempts to send from `billing@productb.com`, the Worker rejects the request immediately.
- **Send Logging**: An immutable audit record is saved in `sent/_sendlog/{uuid}.json` in R2 and recorded in `RELAYBASE_LOGS` D1 database.

---

## The Three D1 Databases Explained

The open-source Worker utilizes three distinct Cloudflare D1 SQLite databases to maintain clean separation of concerns and high performance:

| Database Binding | Purpose | Schema Details |
|---|---|---|
| **`RELAYBASE_DB`** | Product State & Credentials | Domains, verified addresses, domain-scoped API keys, webhook subscriptions, audience contacts, and hashed owner sessions. |
| **`RELAYBASE_MAIL`** | Search & Mail Index | Unified `mailbox_messages` table and `mailbox_fts` (SQLite FTS5 full-text search) over all inbound and sent mail. Fully rebuildable from R2. |
| **`RELAYBASE_LOGS`** | Observability & Audit | Ops event log for all transactional sends, delivery receipts, and inbound bounces. Powers the Dashboard Log page. |

Because Cloudflare R2 serves as the source of truth for all email bodies and attachments, the entire D1 mail index is rebuildable at any time by calling `POST /console/rebuild-mail`.

---

## Security Model: Passtokens & Cryptographic Isolation

The security architecture of `relaybase-worker` is designed around cryptographic self-sovereignty:

1. **Owner Passtoken (`AUTH_PEPPER`)**: During initial setup, the Worker generates an owner passtoken. The plaintext is shown once to the user and stored securely in the local macOS Keychain (`owner-passtoken`) behind Touch ID authentication. The Worker stores only a salted SHA-256 hash combined with the `AUTH_PEPPER` secret environment variable.
2. **Domain-Scoped API Keys**: API keys (`rb_live_...`) are cryptographically bound to a single domain name. The plaintext secret is never stored in D1; only the SHA-256 key hash is stored.
3. **HMAC Webhook Signatures**: Inbound webhooks sent to your applications contain a Stripe-style `Relaybase-Signature` header (`t=timestamp,v1=signature`) computed with HMAC-SHA256, preventing webhook spoofing and replay attacks.
4. **Teammate Scoping**: For shared support mailboxes, teammates can be issued per-account passwords that grant access only to `support@yourdomain.com` without exposing owner-level credentials or other domains on your Cloudflare account.

---

## How to Inspect and Deploy the Worker

The source code is organized as a clean TypeScript project using Wrangler and Drizzle ORM:

```bash
# Clone the open source worker
git clone https://github.com/strum-us/relaybase-worker.git
cd relaybase-worker

# Install dependencies
pnpm install

# Build the bundled Worker script
pnpm run build:bundle

# Deploy directly to your Cloudflare account
pnpm exec wrangler deploy
```

When you use the Relaybase Mac app, you can either let the setup wizard install the Worker automatically via Cloudflare OAuth, or manually deploy the Worker using the open-source repository and Wrangler CLI.

---

## Summary

Relaybase is founded on the principle that developers should own their communications infrastructure. By pairing an open-source Cloudflare Worker with a native desktop client, you get the convenience and speed of a modern email client without sacrificing privacy, control, or data sovereignty.

- Explore the code: [**github.com/strum-us/relaybase-worker**](https://github.com/strum-us/relaybase-worker)
- Learn more about R2 storage: [Why Relaybase stores mail in Cloudflare R2](/resources/why-cloudflare-r2-for-email)
- Learn about API isolation: [Domain-scoped API keys for multi-product teams](/resources/domain-scoped-api-keys-multi-product)
- Get started: [Download Relaybase](/get-started)
