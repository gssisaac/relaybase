# Relaybase — How it works (marketing)

**Audience:** marketers and anyone writing site copy, waitlist email, or launch posts.

**Target reader (end user):** people who already manage **multiple** email addresses — Cloudflare operators with several zones, or Google Workspace users paying seats for `billing@` / `support@` / product aliases.

**Source:** shipped product (`app/`, `server/`, `mobile/`) and product docs. This is the mechanism behind [`FEATURES.md`](./FEATURES.md), not a second feature list. Pitch the outcome first; name Cloudflare primitives (Worker, R2, D1) only when they help a Cloudflare-native reader trust the design.

**Pricing / public-copy rules:** same as `FEATURES.md`. Do not publish prices, Free/Pro SKUs, or Team/Studio seats during private beta. Do not name other inbox apps. Do not imply Relaybase hosts the mailbox.

---

## 1. You install the mailbox into your Cloudflare account

* **Purpose:** There is no Relaybase-hosted mailbox. You need to see what lands in your account, and day-to-day mail must keep working without our website or console in the path.
* **How it works:** Setup → Install (`/setup/install`) deploys five resources into **your** Cloudflare account, from your Mac:

  | Resource | Kind | Role |
  |----------|------|------|
  | `relaybase-api` | Worker | Routing + admin API. After install, the Mac talks only to this URL. |
  | `relaybase-mailbox` | R2 | Inbound and sent originals. |
  | `relaybase-db` | D1 | Domains, addresses, API keys, webhooks, settings. |
  | `relaybase-inbox-index` | D1 | Rebuildable full-text search index. |
  | `relaybase-logs` | D1 | Send and bounce events for the Dashboard Log page. |

  Two paths, same result: **Authorize** (Cloudflare OAuth; the desktop runs Wrangler on your Mac) or **Manual** (download the Worker ZIP, run Wrangler yourself, paste the Worker URL + admin token). Your Cloudflare credential never leaves the machine — we do not receive it, and we do not deploy into our account on your behalf.

  Verify proves the Worker answers with that admin token. From then on, inbox, send, search, and `/v1` hit **your** Worker only. `console.relaybase.xyz` is for account, license, and token recovery. It does not store mail, and it is not in the send/receive path. Install and receive can run on Cloudflare's free plan; sending uses Cloudflare Email Sending on their Workers Paid plan (billed by Cloudflare).

**Copy line:** You install a Worker, a mailbox bucket, and three databases into your Cloudflare account. After that, the app talks to your Worker — not to a Relaybase mail server.

---

## 2. Mail runs in your Cloudflare account

* **Purpose:** Hosted ESPs ask you to hand over nameservers or mail. That is a second vendor and a trust problem for people already on Cloudflare.
* **How it works:** After install, inbound (Email Routing) and outbound (Email Sending) run on the Worker in **your** account. Message bodies live in your R2; addresses, keys, and webhooks live in your D1. Relaybase is the app. We do not host your mail.

**Copy line:** We don't host your mail. The inbox and API run on the Cloudflare account you already operate.

---

## 3. Originals accumulate in your R2 bucket

* **Purpose:** The mailbox of record is yours. Reinstalling the app, opening another Mac, or reading via API all see the same originals.
* **How it works:** When mail hits `support@`, Cloudflare invokes your Worker. The Worker stores one object tree per message in your `relaybase-mailbox` bucket: metadata, the raw MIME, and attachments, grouped by domain. Sent mail is stored beside it under `sent/`. A compact per-domain list (no body) drives the inbox scroll. The Mac `~/.relaybase` folder is a cache, not a second mailbox.

**Copy line:** Mail stacks in your R2, not in a Relaybase cloud.

---

## 4. Search is a D1 index; originals stay in R2

* **Purpose:** You need to find a phrase in the body, not just the subject line. Opening every stored message on each query does not scale once a domain has thousands of messages.
* **How it works:** D1 `inbox-index` is a rebuildable full-text side index. On receive, subject, sender, recipients, and body text are written there. Search hits that index and returns a flat result list. Opening a hit always reloads the real message from R2. If the index is missing or briefly down, receive, storage, and read state still work — the Mac falls back to filtering mail it already loaded, instead of showing a false empty result.

**Copy line:** Originals stay in your bucket. Search is a fast index over those originals — not a forwarded Gmail copy.

---

## 5. Conversations stay on the address that owns them

* **Purpose:** The same thread should not appear twice, and a reply sent as `you@` should not show up as `(me)` inside `support@`.
* **How it works:** Inbox grouping uses Message-ID and RFC reply headers. Sent mail is merged into a thread only when its From matches the account you are viewing. In All inboxes, any of your Sent can show `(me)`. Filtered to `support@`, only mail sent from `support@` does.

**Copy line:** Role addresses share one app. Each conversation still belongs to its address.

---

## 6. API keys are scoped to one domain

* **Purpose:** A Cloudflare token in an app `.env` can send as any domain on the account if it leaks.
* **How it works:** Each key is bound to one domain. A `from` that does not match that domain is rejected. The Worker stores a hash only; the plaintext secret stays on your Mac under `~/.relaybase`.

**Copy line:** A leaked key can impersonate that domain — not every domain on the account.

---

## 7. Inbound webhooks are signed

* **Purpose:** `support@` → forward → Zapier has no signature check, and the weekend ticket pile sits in a human inbox.
* **How it works:** Only a newly stored message creates an event (a To+Cc double delivery does not fire twice). The Worker HMAC-signs the payload and posts it, or you poll the event API. Fetch the full body from R2 only when you need it. Webhooks are per domain.

**Copy line:** Receive becomes a signed event on your domain — not a forwarded copy.

---

## 8. The Mac is a cache; the Worker is the mailbox

* **Purpose:** Read/unread and mail must survive a fresh install, and the app should still open fast.
* **How it works:** Read state lives on each message in R2 (`readAt`). `~/.relaybase` holds credentials, the API-key vault, and list caches. The UI reads the Worker through one mapped API. Clearing the app cache does not clear the mailbox.

**Copy line:** The app is a window. The mailbox is on your Cloudflare account.

---

## 9. A teammate gets that address only

* **Purpose:** Handing someone `support@` usually means a Cloudflare token, a full Workspace seat, or a forward that widens access.
* **How it works:** Accounts → Other device issues a per-address password. Phone or a second desktop signs in with that email and password. Every request is scoped to that one mailbox — no All inboxes, no domain admin, no Audience. Search is limited to messages where that address is on To or Cc.

**Copy line:** You hand over the role mailbox, not the account.

---

## Related

- End-user feature list: [`FEATURES.md`](./FEATURES.md)
- Product positioning: [`PRODUCT.md`](../../PRODUCT.md)
- Install / BYO Worker: [`../pivot-byo-cloudflare.md`](../pivot-byo-cloudflare.md)
- Storage map: [`../storage-architecture.md`](../storage-architecture.md)
- R2 mailbox layout: [`../mailbox-r2.md`](../mailbox-r2.md)
- Inbound search index: [`../inbound-search-d1-fts5.md`](../inbound-search-d1-fts5.md)
- Threading / multi-account: [`../inbox-threading-and-multi-account.md`](../inbox-threading-and-multi-account.md)
- Mobile companion: [`../mobile-email-companion.md`](../mobile-email-companion.md)
