# Relaybase — End-user features (marketing)

**Audience:** marketers and anyone writing site copy, waitlist email, or launch posts.

**Target reader (end user):** people who already manage **multiple** email addresses — Cloudflare operators with several zones, or Google Workspace users paying seats for `billing@` / `support@` / product aliases.

**Source:** shipped product code (`app/`, `server/`, `mobile/`) and existing product docs. Ranked by importance for that persona, not by engineering surface area.

**Pricing / public-copy rules:** `PRICING.md` and `STRATEGY.md` §9. The Free vs paid split below follows the **internal draft** (Free = 1 domain, 1 address, inbox + send/receive API; paid = unlimited domains/addresses, Audience/Broadcasts, teammate access). Dollar amounts and caps can change. Do not publish a price table until official paid launch. During private beta, do not name other inbox apps, do not imply Team/Studio seats, and do not advertise Free/Pro SKUs — testers get the full shipped product.

---

## How this list is ranked

Inside each section, higher items are the stronger pitch for that tier.

1. Inbox and ownership (the job they hire us for)
2. Addresses as infrastructure, not Workspace seats
3. Mail on the Cloudflare account they already run
4. API, webhooks, broadcasts (power features, not the first pitch)

Folders, compose, reply, and trash sit under **Gmail-like mail stack**. Shortcuts sit under **keyboard-first triage**.

---

## Features

Draft Free: one Cloudflare domain, one address, Mac inbox, send + receive API on that domain.

### 1. Mail runs in your Cloudflare account

- **Problem:** Hosted ESPs ask you to hand over nameservers or mail, which is a second vendor and a trust problem for people already on Cloudflare.
- **Solution:** The routing Worker installs into **the customer's** Cloudflare account. Relaybase is the app. We do not host your mail.

### 2. Gmail-like mail stack

- **Problem:** Cloudflare Email Routing has no inbox. Product mail ends up forwarded into Gmail, where folders, drafts, and replies live in someone else's client.
- **Solution:** The usual mail stack in the Mac app: Inbox, Sent, Drafts, and Trash; compose; reply / reply all / forward; conversation threads; read / unread; attachments; per-account signatures; search; ⌘K and right-click actions.

### 3. Keyboard-first triage inbox

- **Problem:** The Cloudflare dashboard and a stack of browser tabs are not a client for reading and clearing mail quickly.
- **Solution:** Stay on the keyboard. Arrows or `j`/`k` move the list; `Enter` opens; `r` reply, `a` reply all, `f` forward; `c` compose, `⇧C` compose new; `e` / Backspace / Delete trash (restore in Trash); `Esc` or `u` back to the list; ⌘K for any command.

### 4. Send and receive on the same domain

- **Problem:** Sending via an ESP and receiving via Gmail forwarding splits brand, replies, and debugging across two systems.
- **Solution:** Cloudflare Email Sending outbound and Email Routing inbound close the loop on `yourdomain.com`.

### 5. A product address without a Workspace seat

- **Problem:** Workspace prices `support@` like a human (~$7/user/month), so a mailbox nobody lives in still consumes a seat.
- **Solution:** Treat the address as domain infrastructure — one `billing@` or `support@` with no per-seat fee.

### 6. Per-account conversation threading (including Sent)

- **Problem:** The same thread can duplicate, or a reply sent as another address leaks into the wrong conversation.
- **Solution:** Dedupe on Message-ID, merge Sent only for the active account, and mark your own replies with `(me)`.

### 7. Full-text mail search

- **Problem:** You cannot find a body from the list alone, and Gmail search only sees forwarded copies.
- **Solution:** An inbound FTS index searches subject and body; originals stay in the customer's R2.

### 8. Signed inbound webhooks / event API

- **Problem:** `support@` → Gmail → forward → Zapier has no signature check, and tickets sit unread over a weekend.
- **Solution:** HMAC-signed webhooks or pollable events on receive; fetch the full body only when you need it.

### 9. Transactional send API + human inbox

- **Problem:** Receipts and password resets need an API; replies to those messages need a person — so teams split tools.
- **Solution:** `POST /v1/send` for automation; the same address's replies land in the Mac inbox.

### 10. Domain-scoped API keys

- **Problem:** A Cloudflare token copied into an app `.env` can send as any domain on the account if it leaks.
- **Solution:** One key per domain. A `from` that does not match that domain is rejected.

---

## Paid version

Draft Pro: unlimited domains and addresses on that Worker, Audience / Broadcasts / Metrics, teammate email-only access. Numbering restarts. During private beta these stay unlocked; after launch, new Free users do not get them (existing beta data is not deleted — `PRICING.md` §0).

### 1. Unified multi-domain inbox

- **Problem:** Cloudflare Email Routing only forwards; Workspace opens a different inbox per domain — mail is scattered across tabs and accounts.
- **Solution:** One Worker and one Mac app show every mailbox on the account, side by side.

### 2. Import Cloudflare zones + DNS / routing onboarding

- **Problem:** Each new domain means repeating Email Sending onboarding, DKIM, MX, and routing rules in the Cloudflare dashboard.
- **Solution:** Import zones from the account; the app continues through DNS wait, provisioning, and address routing.

### 3. All inboxes + per-account switcher

- **Problem:** Switching between `you@` and `support@` means another login, or a personal Gmail inbox where the real recipient is unclear.
- **Solution:** See everything in one list or filter by address, with unread counts per account.

### 4. Unlimited role addresses (`billing@`, `support@`, …)

- **Problem:** Standing up the usual product set on Workspace means a new seat for every alias, on every domain.
- **Solution:** Provision as many role addresses as the domain needs, with no per-address seat fee.

### 5. Standard product addresses in one step

- **Problem:** Every new product means recreating `billing@` through `admin@`, display names, and inbound on/off by hand.
- **Solution:** Adding a domain seeds the six defaults; `noreply@` is send-only, the rest receive immediately.

### 6. Teammate mobile / email-only access

- **Problem:** Handing someone `support@` usually means a Cloudflare token, a full Workspace seat, or a forward that widens access.
- **Solution:** Accounts → Other device issues a per-address password. The teammate sees only that mailbox on phone or desktop.

### 7. Audience / Broadcasts

- **Problem:** Product announcements need another ESP plus Workspace, and subscriber lists leave the domain.
- **Solution:** Audience groups (manual or synced) on the domain; broadcasts and send progress stay in the same dashboard.

---

## Intentionally omitted

| Item | Why |
|------|-----|
| Team / Studio seat SKUs | Modeled in `STRATEGY.md` / `PRICING.md`; not shipped. Do not publish. |
| BIMI / VMC / “logo in Gmail” | Do not build — `docs/bimi-vmc-do-not-build.md`. |
| Operator console (`kembo/admin`, licenses) | Internal. Not an end-user feature. |
| Stars, labels, archive (Gmail extras) | Not shipped. Do not imply them. |

---

## Related

- How it works (selected mechanisms): [`HOW-IT-WORKS.md`](./HOW-IT-WORKS.md)
- Product positioning: [`PRODUCT.md`](../../PRODUCT.md)
- Pricing draft (not public until paid launch): [`PRICING.md`](../../PRICING.md)
- Pre-launch audience and copy rules: [`PRE-LAUNCH.md`](../../PRE-LAUNCH.md)
- Inbox / multi-account behavior: [`inbox-threading-and-multi-account.md`](../inbox-threading-and-multi-account.md)
- Audience / broadcasts: [`audience-and-broadcasts.md`](../audience-and-broadcasts.md)
- Mobile companion: [`mobile-email-companion.md`](../mobile-email-companion.md)
