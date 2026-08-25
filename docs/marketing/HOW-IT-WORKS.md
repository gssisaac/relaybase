# Relaybase — How it works (marketing)

**Audience:** marketers and anyone writing site copy, waitlist email, or launch posts.

**Target reader (end user):** people who already manage **multiple** email addresses — Cloudflare operators with several zones, or Google Workspace users paying seats for `billing@` / `support@` / product aliases.

**Source:** shipped product (`app/`, `server/`, `mobile/`) and product docs — especially Setup → Install (`app/src/app/setup/install/page.tsx` → `WorkerInstallPanel`). This is the mechanism behind [`FEATURES.md`](./FEATURES.md), not a second feature list. Pitch the outcome first; name Cloudflare primitives (Worker, R2, D1) only when they help a Cloudflare-native reader trust the design.

**Pricing / public-copy rules:** same as `FEATURES.md`. Do not publish prices, Free/Pro SKUs, or Team/Studio seats during private beta. Do not name other inbox apps. Do not imply Relaybase hosts the mailbox.

---

## 1. You install the mailbox into your Cloudflare account

* **Purpose:** There is no Relaybase-hosted mailbox. You need to see exactly what lands in your account before the first message, and day-to-day mail must keep working without our website or console in the path.
* **How it works:** Setup → Install deploys five resources into **your** Cloudflare account, from your Mac (same list as the in-app “What we install” panel):

  | Resource | Kind | Role |
  |----------|------|------|
  | `relaybase-api` | Worker | Routing + admin API. After install, the Mac talks only to this URL + your admin token. Relaybase’s servers never see your mail. |
  | `relaybase-mailbox` | R2 | Inbound and sent originals (`inbound/` and `sent/`). Only you and your Worker can read them. |
  | `relaybase-db` | D1 | Domains, addresses, API keys, webhooks, audience, broadcasts, settings. Lives entirely in your account. |
  | `relaybase-mail` | D1 | Rebuildable list, count, and full-text search index. Bodies stay in R2. |
  | `relaybase-logs` | D1 | Send and bounce events for the Dashboard Log page. |

  Two paths, same result:

  - **Authorize** — Cloudflare OAuth in the system browser. The desktop runs Wrangler on your Mac (creates R2/D1, sets `ADMIN_TOKEN`, deploys the Worker).
  - **Manual** — download the pre-built Worker ZIP, run Wrangler yourself, paste the Worker URL + admin token.

  Your Cloudflare credential never leaves the machine. We do not receive it, and we do not deploy into our account on your behalf.

  After **Verify**, inbox, send, search, and `/v1` hit **your** Worker only. `console.relaybase.xyz` is for account, license, and admin-token recovery. It does not store mail, and it is not in the send/receive path. If our site is down, your Worker still receives and stores mail.

  Install and receive can run on Cloudflare’s free plan. Sending uses Cloudflare Email Sending on their Workers Paid plan (billed by Cloudflare, not by us).

**Copy line:** You install a Worker, a mailbox bucket, and three databases into your Cloudflare account. After that, the app talks to your Worker — not to a Relaybase mail server.

---

## 2. Mail runs in your Cloudflare account

* **Purpose:** Hosted ESPs ask you to hand over nameservers or mail. That is a second vendor and a trust problem for people already on Cloudflare.
* **How it works:** After install, inbound (Cloudflare Email Routing) and outbound (Cloudflare Email Sending) both run on the Worker in **your** account. Message bodies live in your R2; addresses, keys, and webhooks live in your D1. The Mac app is a client. We do not host your mail, and we do not ask you to point nameservers at Relaybase.

**Copy line:** We don’t host your mail. The inbox and API run on the Cloudflare account you already operate.

---

## 3. Originals accumulate in your R2 bucket

* **Purpose:** The mailbox of record is yours. Reinstalling the app, opening another Mac, or reading via API all see the same originals.
* **How it works:** When mail hits `support@`, Cloudflare invokes your Worker once per matching local address. The Worker writes one object tree per new message in your `relaybase-mailbox` bucket, grouped by domain:

  ```text
  inbound/{domain}/{id}/meta.json | raw.eml | attachments/…
  inbound/{domain}/by-message-id/…     ← one stored copy per RFC Message-ID
  sent/{domain}/{id}/meta.json | raw.eml | attachments/…
  ```

  Each message is its own folder. A thin `meta.json` holds headers and a short preview; the body lives in `raw.eml`. Lists, unread counts, and pagination come from D1 `relaybase-mail`, not a per-domain array file. Opening a message parses `raw.eml` on demand. The Mac `~/.relaybase` folder caches list pages; it is not a second mailbox. Inbound retention is unlimited by default; a per-domain cap can be set in desktop Settings → Mailbox.

**Copy line:** Mail stacks in your R2, not in a Relaybase cloud.

---

## 4. Search is a D1 index; originals stay in R2

* **Purpose:** You need to find a phrase in the body, not just the subject line. Opening every stored message on each query does not scale once a domain has thousands of messages. Forwarded Gmail copies are not the originals.
* **How it works:** D1 `relaybase-mail` is a rebuildable index (`mailbox_messages` + `mailbox_fts`) over your R2 originals. On receive or send, subject, sender, recipients, and body text are written there. Search hits that index and returns a flat result list. Opening a hit always reloads the real message from R2 (`raw.eml`).

  R2 stays authoritative. Index writes are best-effort: if the index is missing or briefly down, receive, storage, and read state still work. The Mac then filters mail it already loaded, instead of showing a false “no results.” Historical mail can be backfilled with `POST /console/rebuild-mail`. Sent search uses the same index (`kind=sent`) — it is not a second database.

**Copy line:** Originals stay in your bucket. Search is a fast index over those originals — not a forwarded copy.

---

## 5. Conversations stay on the address that owns them

* **Purpose:** The same thread should not appear twice, and a reply sent as `you@` should not show up as `(me)` inside `support@`.
* **How it works:** Cloudflare Email Routing calls the Worker once per matching address (To and Cc). The Worker stores a single copy keyed by Message-ID, so a dual delivery does not create two objects or two webhooks. The inbox then shows that copy to every address that was on To or Cc.

  Conversation grouping uses Message-ID and RFC reply headers. Sent mail is merged into a thread only when its From matches the account you are viewing. In All inboxes, any of your Sent can show `(me)`. Filtered to `support@`, only mail sent from `support@` does.

**Copy line:** Role addresses share one app. Each conversation still belongs to its address.

---

## 6. API keys are scoped to one domain

* **Purpose:** A Cloudflare token in an app `.env` can send as any domain on the account if it leaks.
* **How it works:** Each Relaybase API key is bound to one domain. A `from` that does not match that domain is rejected. The Worker stores a hash only. The plaintext secret is shown once and kept on your Mac under `~/.relaybase` — not in D1, and not on Relaybase’s servers.

**Copy line:** A leaked key can impersonate that domain — not every domain on the account.

---

## 7. Inbound webhooks are signed

* **Purpose:** `support@` → forward → Zapier has no signature check, and the weekend ticket pile sits in a human inbox with no way to prove the event is real.
* **How it works:** Only a **newly stored** message creates an event (a To+Cc double delivery does not fire twice). The Worker HMAC-signs the payload and posts it to your URL, or you poll the event API. Fetch the full body from R2 only when you need it. Webhooks are per domain, same as API keys.

**Copy line:** Receive becomes a signed event on your domain — not a forwarded copy.

---

## 8. The Mac is a cache; the Worker is the mailbox

* **Purpose:** Read/unread and mail must survive a fresh install or another Mac, and the app should still open fast.
* **How it works:** Read state lives on each message in R2 (`readAt`). `~/.relaybase` holds the Worker URL, admin token, API-key vault, and list caches — not the originals. The UI reads the Worker through one mapped API. Clearing the app cache does not clear the mailbox. Search falling back to local filter (see §4) is the same idea: the app can be wrong or empty; the Worker is not.

**Copy line:** The app is a window. The mailbox is on your Cloudflare account.

---

## 9. A teammate gets that address only

* **Purpose:** Handing someone `support@` usually means a Cloudflare token, a full Workspace seat, or a forward that widens access.
* **How it works:** Accounts → Other device issues a per-address password. Phone or a second desktop signs in with that email and password only (no Worker URL to type). Every request is scoped to that one mailbox — no All inboxes, no domain admin, no Audience, no API keys. Search is limited to messages where that address is on To or Cc. The teammate never receives the owner’s admin token or Cloudflare credential.

**Copy line:** You hand over the role mailbox, not the account.

---

## Related

- End-user feature list: [`FEATURES.md`](./FEATURES.md)
- Product positioning: [`PRODUCT.md`](../../PRODUCT.md)
- Install / BYO Worker: [`../pivot-byo-cloudflare.md`](../pivot-byo-cloudflare.md)
- Storage map: [`../storage-architecture.md`](../storage-architecture.md)
- R2 mailbox layout: [`../mailbox-r2.md`](../mailbox-r2.md)
- Mail index (list + search): [`../mailbox-d1.md`](../mailbox-d1.md)
- Threading / multi-account: [`../inbox-threading-and-multi-account.md`](../inbox-threading-and-multi-account.md)
- Mobile companion: [`../mobile-email-companion.md`](../mobile-email-companion.md)
