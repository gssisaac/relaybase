---
title: "Using Relaybase with Google Workspace: Subdomain Coexistence & MBOX Migration"
navTitle: "Google Workspace & Relaybase"
description: "Why Google Workspace and Cloudflare Email Routing can't share a root domain, how to run side-by-side using subdomains, and how to migrate past Gmail archives to Cloudflare R2."
keyword: "Google Workspace Cloudflare email routing subdomain migration"
order: 14
date: "2026-09-07"
image: "/images/resources/google-workspace-coexistence-hero.png"
imageAlt: "Illustration of a single root domain split between Google Workspace and Cloudflare Email Routing, blocked by DNS MX rules with a disappointed developer seeing a bounce error"
---

When founders and developers discover Relaybase, they usually arrive with an existing setup: their company domain (`yourcompany.com`) is already tied to **Google Workspace** (or Microsoft 365) for team email, Google Calendar, and Google Drive.

The initial goal is simple: *Keep existing human inboxes in Google Workspace, but use Relaybase to handle product and transactional email (`support@`, `billing@`, inbound webhooks, and API keys) without paying $7/month for each new address.*

However, as soon as they try configuring Cloudflare Email Routing on their primary domain, they hit a fundamental DNS roadblock.

Here is why Google Workspace and Cloudflare Email Routing cannot share the exact same root domain, how to run both systems side-by-side seamlessly using **subdomains**, and how to perform a **full, zero-data-custody migration** using the open-source [`relaybase-mbox-migration`](https://github.com/strum-us/relaybase-mbox-migration) tool if you decide to replace Google Workspace entirely.

---

## Why Google Workspace and Cloudflare Can't Share a Single Root Domain

A common first question is: *"Can I keep `alex@yourcompany.com` in Google Workspace and route `support@yourcompany.com` to Relaybase on the same root domain?"*

The short answer is **no, not on the exact same root domain**. This is not a limitation of Relaybase or Cloudflare; it is a fundamental rule of how DNS Mail Exchange (MX) records work on the internet.

### How DNS MX Resolution Works

When an external mail server (e.g. Gmail, Outlook, or an automated service) sends an email to `support@yourcompany.com`, it performs a DNS lookup for the **MX records** of `yourcompany.com`.

```text
Sending Mail Server
        │
        ▼ (Query MX for yourcompany.com)
  DNS Nameserver
        │
        ├── Priority 1:  ASPMX.L.GOOGLE.COM (Google Workspace)
        └── Priority 10: ISAAC.MX.CLOUDFLARE.NET (Cloudflare Email Routing) ❌ Fails
```

1. **DNS MX does not inspect the username**: DNS operates at the domain level, not the mailbox level. It cannot say *"send `alex@` to Google and `support@` to Cloudflare"*. All incoming traffic for `@yourcompany.com` is directed to whichever MX servers are configured.
2. **MX priority is not a fallback between different providers**: MX priorities exist so mail servers can reach *redundant backup servers of the same provider*. If Google's servers (Priority 1) are online, the sending server connects to Google. When Google sees that `support@yourcompany.com` does not have an active Google Workspace paid seat, it immediately rejects the email with a permanent bounce (`550 5.1.1 User unknown`). It will **never** forward or pass the connection to Cloudflare (Priority 10).
3. **Equal priorities cause split-brain delivery**: If you configure both Google and Cloudflare with equal MX priority, sending servers will alternate between them randomly. Some emails will land in Google Workspace, while others land in Cloudflare, resulting in dropped messages and broken email threads.

Because of this DNS reality, you have two practical, production-ready paths.

---

## Option 1: Side-by-Side Coexistence via Subdomain (Recommended & Instant)

If your team relies on Google Workspace for personal human mailboxes, Google Meet, and Drive, the industry-standard architecture is to **isolate your product emails on a subdomain**.

The good news: you do not have to pick one provider for everything. A **subdomain** gives Relaybase its own MX records while your team keeps Gmail on the root domain.

### How It Works

- **Root Domain (`yourcompany.com`)**: Kept on Google Workspace. Personal emails like `alex@yourcompany.com` and `sarah@yourcompany.com` continue working in Gmail without any interruption.
- **Subdomain (`mail.yourcompany.com` or `app.yourcompany.com`)**: Delegated to Cloudflare Email Routing and Relaybase. Product addresses like `support@mail.yourcompany.com`, `billing@mail.yourcompany.com`, and `notifications@app.yourcompany.com` route directly to your Relaybase Worker and R2 mailbox.

### DNS Record Comparison

In your Cloudflare DNS dashboard, the records coexist cleanly:

| Type | Name | Content / Target | Priority | Purpose |
| :--- | :--- | :--- | :---: | :--- |
| **MX** | `@` (root) | `aspmx.l.google.com` | `1` | Google Workspace personal email |
| **MX** | `@` (root) | `alt1.aspmx.l.google.com` | `5` | Google Workspace backup |
| **TXT** | `@` (root) | `v=spf1 include:_spf.google.com ~all` | — | Google SPF authentication |
| **MX** | `mail` (subdomain) | `isaac.mx.cloudflare.net` | `10` | **Relaybase product email** |
| **MX** | `mail` (subdomain) | `amir.mx.cloudflare.net` | `20` | **Relaybase product email** |
| **TXT** | `mail` (subdomain) | `v=spf1 include:_spf.mx.cloudflare.net ~all` | — | **Cloudflare SPF authentication** |

### Why This Pattern Is Standard Practice

1. **Zero Disruption**: You don't need to touch your team's Google Workspace accounts or migrate any past emails.
2. **Domain Reputation Protection**: High-volume transactional emails, password resets, and marketing broadcasts won't risk damaging the deliverability of your team's day-to-day corporate communication.
3. **Industry Standard**: Major tech products follow this exact convention. For example:
   - GitHub sends notifications from `@reply.github.com`
   - Stripe routes receipts from `@support.stripe.com`
   - Slack routes system notices from `@mail.slack.com`
4. **Instant Setup**: You can add the subdomain in Relaybase Desktop, verify DNS records, and start sending and receiving in under 3 minutes.

---

## Option 2: Full Migration to Relaybase (Eliminate Seat Fees & Own Your Data)

For solo founders, bootstrapped startups, or agencies looking to eliminate monthly Google Workspace bills entirely ($7 to $28 per user per month), you can migrate your root domain completely to Relaybase.

The biggest blocker in moving away from Google Workspace has always been: *“What happens to years of customer support history, invoices, and threads locked inside Gmail?”*

### The Privacy Problem with Traditional Migration Tools

Most third-party email migration services require you to enter your Google admin credentials or grant broad IMAP/OAuth permissions to their cloud servers. That means a third-party company downloads, indexes, and temporarily stores every sensitive email your business has ever sent or received.

### The Solution: Open Source `relaybase-mbox-migration`

To solve this without compromising security, we built and open-sourced [**`relaybase-mbox-migration`**](https://github.com/strum-us/relaybase-mbox-migration) ([github.com/strum-us/relaybase-mbox-migration](https://github.com/strum-us/relaybase-mbox-migration)).

- 🔒 **100% Local & Private**: Runs completely on your own computer. Your email data never touches Relaybase servers or any third-party relay.
- 📦 **Direct to Your Cloudflare R2**: Parses Google Takeout `.mbox` archives locally and uploads raw MIME streams (`raw.eml`), lightweight headers (`meta.json`), and attachments straight into **your** `relaybase-mailbox` Cloudflare R2 bucket.
- ⚡ **Instant Search Indexing**: Populates the unified Cloudflare D1 SQLite mail index (`RELAYBASE_MAIL`) with FTS5 full-text search.
- 🔁 **Automatic Deduplication**: Tracks RFC `Message-ID` headers to ensure re-running the migration never creates duplicate messages.
- 🌊 **Streaming Parser**: Handles massive 10GB+ MBOX exports smoothly with minimal memory footprint.

---

## Step-by-Step Guide: Migrating from Google Takeout to Cloudflare R2

### Step 1: Export Your Email from Google Takeout

1. Visit [Google Takeout](https://takeout.google.com/).
2. Click **Deselect all**, then scroll down and check only **Mail**.
3. Ensure **MBOX format** is selected under the options.
4. Click **Next step** and create the export.
5. Download and unzip the archive to extract your `.mbox` file (e.g. `Takeout/Mail/All mail Including Spam and Trash.mbox`).

---

### Step 2: Download the Migration CLI

You can download the pre-compiled release archive without needing to clone or compile code:

```bash
VERSION=v0.1.0

curl -fsSL \
  "https://github.com/strum-us/relaybase-mbox-migration/releases/download/${VERSION}/relaybase-mbox-migration-${VERSION#v}.tar.gz" \
  | tar xz

cd "relaybase-mbox-migration-${VERSION#v}"
```

*(Alternatively, clone from source via `git clone https://github.com/strum-us/relaybase-mbox-migration.git && pnpm install && pnpm run build`)*.

---

### Step 3: Run a Dry-Run Preview

Before uploading anything to Cloudflare R2, run a dry-run to verify the message count and label breakdown:

```bash
node bin/cli.mjs \
  --mbox "/path/to/All mail Including Spam and Trash.mbox" \
  --email "support@yourdomain.com"
```

The CLI will stream through the archive, detect inbound vs. sent messages based on headers, and display a summary table without modifying your storage.

---

### Step 4: Perform the Live Upload (`--apply`)

When you're ready to upload directly to your Cloudflare R2 bucket:

```bash
node bin/cli.mjs \
  --mbox "/path/to/All mail Including Spam and Trash.mbox" \
  --email "support@yourdomain.com" \
  --apply
```

> **Authentication Tip:** If you have run `npx wrangler login` on your terminal, the CLI will automatically detect your Cloudflare credentials. Alternatively, set `CLOUDFLARE_API_TOKEN="your_token"` in your environment.

---

### Step 5: Rebuild the Relaybase Search Index

Once your historical emails and attachments are uploaded to R2, trigger the search index rebuild so they appear in your Relaybase desktop app:

#### Option A: In the Desktop App
Open **Relaybase Desktop** → **Settings** → **Mailbox** → Click **Rebuild Mail Index**.

#### Option B: Via cURL
```bash
curl -X POST "https://<your-relaybase-worker-url>/console/rebuild-mail?domain=yourdomain.com" \
  -H "Authorization: Bearer <your-owner-passtoken>"
```

All imported threads, attachments, and historical messages will now be fully searchable in the desktop client and queryable via the REST API.

---

### Step 6: Point Root MX Records to Cloudflare

After migration is complete and verified in the Relaybase app:
1. Log in to your Cloudflare dashboard.
2. Remove the old Google Workspace MX records.
3. Enable Cloudflare Email Routing for your root domain (`@`).
4. You are now running 100% on your own Cloudflare infrastructure with zero per-seat fees.

---

## Frequently Asked Questions (FAQ)

### Q: What Cloudflare API Token permissions are required for Relaybase?

When creating a custom Cloudflare API Token in your Cloudflare dashboard for Relaybase, ensure the following permissions are granted:

- **`Zone → Email Routing Rules → Edit`** (Required to configure address routing rules)
- **`Zone → Zone → Read`** (Required to list and inspect domain zones)
- **`Zone → DNS → Edit`** (Required to configure MX and SPF records)
- **`Account → Workers R2 Storage → Edit`** (Required for R2 mailbox uploads and migration)

If your token lacks `Email Routing Rules → Edit`, the Relaybase Worker will return a permission error when attempting to verify or activate an address.

### Q: Does using a subdomain look unprofessional to customers?

Not at all. In fact, receiving transactional receipts or support updates from `support@mail.yourdomain.com` or `help@support.yourdomain.com` is standard across thousands of modern companies, including Stripe, GitHub, Uber, and Figma. It also provides clean sender reputation separation.

### Q: Can I migrate multiple team members' mailboxes?

Yes. Each team member can generate a Google Takeout `.mbox` archive for their respective account. Run the `relaybase-mbox-migration` CLI for each file, passing their corresponding email address in the `--email` parameter:

```bash
# Migrate Sarah's past emails
node bin/cli.mjs --mbox "./sarah.mbox" --email "sarah@yourdomain.com" --apply

# Migrate Alex's past emails
node bin/cli.mjs --mbox "./alex.mbox" --email "alex@yourdomain.com" --apply
```

### Q: What happens if the migration CLI is interrupted?

The CLI computes deterministic message pointers based on RFC `Message-ID` hashes. If your internet connection drops or the script is interrupted midway, simply rerun the exact same command with `--apply`. The CLI will skip messages that are already present in R2 and resume uploading where it left off.

---

## Comparison: Subdomain Coexistence vs. Full Migration

| Factor | Option 1: Subdomain Coexistence | Option 2: Full Migration |
| :--- | :--- | :--- |
| **Best For** | Teams keeping Google Workspace for personal email | Founders wanting $0 seat fees & 100% data control |
| **Setup Time** | **2–3 minutes** (Instant DNS addition) | **15–30 minutes** (Takeout export + CLI upload) |
| **Email Format** | `support@mail.yourdomain.com` | `support@yourdomain.com` |
| **Google Workspace Status** | Active (keeps existing seats) | Cancelled (saves $7–$28/user/month) |
| **Historical Email Access** | Kept in Gmail | Uploaded to R2 via `relaybase-mbox-migration` |
| **Data Custody** | Split (Google + Cloudflare) | **100% Self-Sovereign** (Your Cloudflare Account) |

---

## Summary

You don't have to choose between breaking your existing Google Workspace setup and paying high per-seat costs for product addresses:

- If you want an **instant, zero-friction setup**, keep Google Workspace on your root domain and connect Relaybase on a **subdomain** like `mail.yourdomain.com`.
- If you want **complete data sovereignty and zero seat fees**, run the open-source [**`relaybase-mbox-migration`**](https://github.com/strum-us/relaybase-mbox-migration) CLI to import your Google Takeout archives directly into your Cloudflare R2 bucket.

Learn more about how Relaybase stores emails with zero egress costs in [Why Relaybase Stores Mail in Cloudflare R2](/resources/why-cloudflare-r2-for-email), or inspect the open-source architecture in [The Open Source Cloudflare Email Worker](/resources/open-source-cloudflare-worker). Ready to get started? [Download Relaybase](/get-started).
