# Inbox detail showed `(empty message)` and empty To for all mail

**Date:** 2026-08-11  
**Status:** Fixed (cherry-pick of `main` commit `d8a5f52`)  
**Severity:** High (every opened email appeared empty; user could not read mail)  
**Components:** `app/src/email/email-mailbox-store.ts` (`loadMessageDetail`), `server/src/lib/inbound-store.ts` (legacy MIME From backfill)

## Summary

Every opened email — regular inbox mail (e.g. a Google Takeout notification), forwarded messages, and bounce DSNs — rendered as `(empty message)` with a blank `To` field in the detail pane. The R2 data was intact; only the client display was broken.

## Symptoms

1. Selecting any message in the inbox list showed `(empty message)` in the body area.
2. The `To` field in the detail header was blank even though the message had recipients.
3. Forwarded messages (`Fwd: …`) and bounce DSNs (`bounces@cf-bounce.kloyapp.com`) were affected identically — confirming it was not forward/bounce-specific.
4. R2 `meta.json` for the same messages carried full `bodyText` / `bodyHtml` / `toEmails`.

## Root cause

The inbox detail API returns the message wrapped: `c.json({ message: serializeMessage(message) })` (`server/src/routes/mail/inbox.ts`). The client `loadMessageDetail` stored the **wrapper object** as the detail:

```ts
const data = await readResponseJson<RoutingActivityEvent & { error?: string }>(res);
this.activityDetailByKey[messageId] = data; // ← { message: {...} }, not the message
```

So `activityDetail.bodyText`, `.toEmails`, `.fromEmail` were all `undefined`. `InboundEmailDetail` (`app/src/email/components/EmailShared.tsx`) renders `(empty message)` when `bodyText` is falsy and there is no HTML; the thread view's `To` rendering joined an empty recipient list.

A second gap: the disk detail cache was trusted unconditionally, so a stale cache entry with no body fields could block a refetch forever.

The fix already existed on `main` (commit `d8a5f52`, 2026-08-11 17:08 +0700) but was missing from the active feature branch `cursor/central-account-recovery-pro-billing-2d76`.

## Fix

Cherry-picked `d8a5f52` onto the feature branch (new commit `b23efb2`):

1. **Client unwrap** — parse `data.message` and store the unwrapped message as the detail; throw if missing.
2. **Skip incomplete disk cache** — only use a persisted detail when it has `bodyText` / `bodyHtml` / attachments, otherwise refetch from the API.
3. **Server legacy MIME From backfill** — `backfillLegacyFrom` re-parses `raw.eml` for R2 rows predating the `fromName` field, recovers the human-readable `From:` header, and persists the corrected meta so future reads skip the parse.

## Verification

- `pnpm run typecheck` (server): passed
- `pnpm run test:unit` (app): 42/42 passed
- Lint on changed files: no errors
- Live R2 check: Google Takeout message (`ee62ad05…`) carried `bodyText` 783 chars, `bodyHtml` 5978 chars, `toEmails` populated — content was never lost, only mis-displayed.
- Restarted `tauri dev` with cleared turbopack cache; opening messages now shows full bodies and `To`.

## Related

- `2026-08-10-send-log-false-positive-empty-disposition.md` — earlier report of the same `(empty message)` symptom on bounce DSNs; that issue was a subset of this broader client bug.
- The forward-to-`isaac@isaaclee.xyz` bounce observed on 2026-08-11 21:01 KST is a real async bounce (CF Email Sending empty disposition), documented in the prior report; the UI empty display was this bug.
