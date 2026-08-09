# Inbox threading & multi-account mail

**Audience:** humans and coding agents changing inbound Worker storage, conversation stacking, account filters, Sent merge into Inbox, or `(me)` labels.

**Primary code:**

| Area | Path |
|------|------|
| Worker ingest / Message-ID dedupe | `server/src/lib/inbound-store.ts`, `server/src/inbound.ts`, `server/src/index.ts` |
| Conversation grouping | `app/src/email/conversation-threading.ts` |
| Inbox list / account filter | `app/src/email/components/MailListView.tsx` |
| Thread UI (`(me)`) | `app/src/email/components/ConversationThreadView.tsx` |
| Enabled-account visibility | `app/src/email/email-mailbox-store.ts` |
| Compose → Sent upsert | `app/src/email/components/useComposeDraftController.ts`, `email-send-events.ts` |
| App send API | `app/src/app/api/email/send/route.ts` |

---

## Cloudflare delivers once per local address

Email Routing invokes the Worker **once per matching local address**. A single MIME message like:

- **To:** `support@example.com`
- **Cc:** `isaac@example.com`

…produces **two** `email()` handler calls when both addresses have Worker routes. Same RFC `Message-ID`, different envelope `message.to`.

### Symptoms (before fix)

- Opening either account’s inbox showed the same message **twice** in one conversation stack (one collapsed, one expanded).
- Unread counts and list APIs could double-count.

### Required ingest behavior

In `storeInboundEmail`:

1. Normalize the RFC `Message-ID`.
2. Look up `inbound/{domain}/by-message-id/{encodedId}` (and fall back to a meta scan for pre-index rows).
3. If a record already exists → return it with `created: false` (do **not** allocate a new UUID tree).
4. If new → write meta/raw, write the Message-ID index, return `created: true`.
5. `email()` handler must **skip** webhook / inbox-notification enqueue when `created === false`.

`listInboundEmails` also collapses historical duplicates that share a Message-ID (keeps newest).

### Client safety net

Even with old duplicate R2 objects still present:

- `collapseDuplicateInbound()` runs inside `groupConversations()` and keeps one richer copy per Message-ID.
- Account membership must use **envelope To + MIME `toEmails` + `ccEmails`** (`inboundMatchesAccount`), not envelope `toEmail` alone — otherwise after ingest dedupe a Cc-only viewer would miss the mail.

---

## Account-scoped Sent in Inbox threads

Inbox conversations merge inbound + Sent via RFC headers / `replyKey`.

### Symptom (before fix)

- Reply from `isaac@` (not Reply all) still appeared inside `support@`’s thread with a `(me)` badge.
- Cause: threading used **all** visible Sent rows, and `(me)` meant `kind === "sent"` regardless of the sidebar account filter.

### Required UI behavior

| Sidebar filter | Sent rows in the thread | `(me)` badge |
|----------------|-------------------------|--------------|
| `all` | All enabled-account Sent | Any of our Sent |
| `support@…` | Only `from === support@…` | Only that From |
| `isaac@…` | Only `from === isaac@…` | Only that From |

Helpers:

- `filterSentForAccount(sent, accountFilter)` — pass into `groupConversations`
- `sentIsMeForAccount(from, accountFilter)` — gate the `(me)` label

Do **not** reintroduce “every Sent is me” when an account filter is active.

---

## Compose send → Sent folder

Related reliability rules (compose Unsend → `POST /api/email/send`):

1. **Never fake success** when the Relaybase worker is not configured — return `503` instead of writing a local-only Sent row.
2. On success, upsert the response `sent` record into the mailbox store **before** force-refresh so a lagging remote KV read cannot wipe the new row.
3. Force refresh of Sent must **union** prior local Sent with the network list (remote KV is eventually consistent in local OpenNext + remote bindings).
4. `readUserEmailData` unions FS + KV `sent` arrays so `/api/email/sent` stays honest in local dev.
5. Worker `/v1/send` must fail when every recipient is in `permanent_bounces` and none are delivered/queued.

---

## Checklist when changing this area

- [ ] Ingest still idempotent on Message-ID (To+Cc dual delivery + CF redelivery).
- [ ] Duplicate deliveries do not enqueue a second inbox notification / webhook.
- [ ] Account filter + Cc membership still shows the mail after single-copy storage.
- [ ] Filtered inbox threads do not pull in another account’s Sent / `(me)`.
- [ ] Unit coverage in `app/src/email/conversation-threading.test.ts` for collapse, Cc match, and Sent filter.
- [ ] Worker deployed after `inbound-store` / `send` route changes (`pnpm --dir server deploy`).
