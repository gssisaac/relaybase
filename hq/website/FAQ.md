# Relaybase Landing Page FAQ

This document outlines the proposed Frequently Asked Questions (FAQ) section to be placed right above the website footer on `relaybase.xyz`.

---

## 1. Google Workspace & Custom Domain Coexistence

### Q1: Can I use Relaybase on the same root domain as Google Workspace or Microsoft 365?
**Answer:**
No, not on the exact same root domain (`yourcompany.com`). DNS Mail Exchange (MX) records operate at the domain level, directing all incoming email for a domain to a single provider. DNS cannot split incoming traffic by username (e.g., routing `alex@` to Google and `support@` to Cloudflare).

A subdomain of the same zone (for example `mail.yourcompany.com`) does not work either. To use Relaybase, either point a **separate registered domain** at Cloudflare, or **migrate the existing domain** off Google Workspace: import past archives into Cloudflare R2 with the open-source migration tool, then point root MX records to Cloudflare.

---

### Q2: How do I migrate historical emails if I leave Google Workspace?
**Answer:**
We built and open-sourced [**`relaybase-mbox-migration`**](https://github.com/strum-us/relaybase-mbox-migration) to solve this without third-party data exposure. 

Unlike SaaS migration services that require giving cloud servers your Google admin credentials, our CLI runs **100% locally on your machine**. It streams your Google Takeout `.mbox` export, parses MIME structures locally, uploads directly to your Cloudflare R2 bucket (`relaybase-mailbox`), and triggers instant search indexing in Cloudflare D1.

---

## 2. Architecture & Data Privacy

### Q3: Does Relaybase have custody of my emails?
**Answer:**
**Zero data custody.** Relaybase operates no multi-tenant mail proxy, central message store, or relay servers. 

When you install Relaybase, our open-source routing Worker ([`strum-us/relaybase-worker`](https://github.com/strum-us/relaybase-worker)) deploys directly into **your own Cloudflare account**. All raw MIME emails and attachments are stored in your Cloudflare R2 bucket, and search indices live in your Cloudflare D1 databases. Your data never touches Relaybase servers.

---

### Q4: Is the backend Worker really 100% open source?
**Answer:**
Yes. The entire product Worker is open source under the MIT license at [github.com/strum-us/relaybase-worker](https://github.com/strum-us/relaybase-worker). You can inspect every line of code, D1 schema, and webhook signature before deploying it via Wrangler or the Relaybase Mac app installer.

---

## 3. Cloudflare Requirements, Security & Pricing

### Q5: What Cloudflare account requirements and costs are involved?
**Answer:**
Relaybase connects to Cloudflare's serverless primitives: **Cloudflare Email Routing**, **Cloudflare Email Sending**, **Cloudflare Workers**, **R2 Object Storage**, and **D1 SQL Databases**.

- **Relaybase:** A one-time software license for the Mac client and management tools.
- **Cloudflare:** Billed separately and directly by Cloudflare to you (typically Cloudflare Workers Paid at ~$5/month, while R2 includes 10 GB of free storage every month with zero egress fees). Relaybase is not a reseller of Cloudflare services.

---

### Q6: What Cloudflare API Token permissions are needed, and why is it secure?
**Answer:**
**Relaybase never receives, stores, or holds custody of your Cloudflare API Token.** 

The API Token is stored strictly as an encrypted secret on **your own Worker** in your Cloudflare account (`CF_API_TOKEN` wrangler secret). When creating the token in your Cloudflare dashboard, it only needs the exact permissions required for your Worker to manage DNS and email routing rules:
- **`Zone → Email Routing Rules → Edit`** (Configure address routing)
- **`Zone → Zone → Read`** (List and inspect domain zones)
- **`Zone → DNS → Edit`** (Add required MX and SPF records)
- **`Account → Workers R2 Storage → Edit`** (R2 mailbox storage)

Because the token lives entirely inside your Cloudflare infrastructure, Relaybase servers never have access to your credentials or account.

---

## 4. Features & Product Scope

### Q7: How is Relaybase different from transactional email services like Resend or SendGrid?
**Answer:**
Resend, SendGrid, and Postmark are excellent APIs focused primarily on **outbound sending**. 

Relaybase is a **two-way product email infrastructure**:
- **Inbound & Outbound:** Receive customer replies at `support@` or `billing@`, view them in a native desktop inbox, and reply directly.
- **Developer Primitives:** Inbound HMAC-signed webhooks, pollable event APIs, and domain-scoped API keys (`rb_live_...`).
- **No Per-Seat Pricing:** Manage multiple product addresses across all your Cloudflare domains without paying per-mailbox SaaS fees.

---

### Q8: Which platforms are supported?
**Answer:**
- **macOS:** Available now. Native desktop client built for Apple Silicon (macOS 12+) and Intel Macs.
- **Mobile (iOS & Android):** On our roadmap (coming soon) — companion app for team triage of assigned product inboxes.
- **Windows / Linux:** Desktop support is on our roadmap.
