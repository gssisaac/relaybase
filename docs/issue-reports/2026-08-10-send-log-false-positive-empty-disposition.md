# Send log false positive when Cloudflare returns empty disposition

**Date:** 2026-08-10  
**Status:** Partially fixed; logging heuristic reverted  
**Severity:** Medium (misleading ops dashboard; delivery still failed asynchronously)  
**Components:** `server/src/routes/admin-send.ts`, `server/src/routes/send.ts`, inbound bounce body fallback (`bounce-detect.ts` / `inbound-store.ts`)

## Summary

Compose forward to `isaac@wedesk.so` appeared successful in Sent and Dashboard Log (HTTP 200, status OK), while the recipient never received the message. Instead, the sender inbox received an empty bounce DSN from `bounces@cf-bounce.kloyapp.com` with subject `Fwd: Question about where my screenshots go`.

## Symptoms

1. **Sent folder** showed a full forward body (`Hey, can you get this?` + quoted original).
2. **Dashboard Log** showed a Compose Send row at the same timestamp with:
   - Status: **OK**
   - HTTP status: **200**
   - Details: `{"delivered":[],"queued":[]}`
3. A second Log row (Inbound / Bounce / Failed) arrived at the same second for peer `isaac@wedesk.so`.
4. Opening the bounce message in the mail UI showed **`(empty message)`**.

## Root cause

### 1. Empty disposition is not a reliable failure signal

Cloudflare Email Sending returns per-recipient disposition arrays:

- `delivered`
- `queued`
- `permanent_bounces`

Asynchronous bounces do **not** appear in the synchronous send response. They arrive later as inbound DSN mail from `bounces@cf-bounce.*`.

Importantly, Cloudflare can also return HTTP 200 / `success: true` with **all three arrays empty** for messages that are later **delivered successfully**. Empty disposition means “no synchronous per-recipient status,” not “failed.”

### 2. Bounce DSN body looked empty before fallback was live

CF bounce MIME is typically `multipart/report`. `postal-mime` extracts top-level `text/plain` only, so DSN bodies often parse as empty. Bounce detection + `buildBouncePreview()` fallback fills a diagnostic preview when the Worker is deployed.

## Fix history

### Attempt: fail closed on empty disposition (`f3dc228`)

Logged `ok: false` when `delivered` and `queued` were both empty. Deployed, then observed a **false negative**: compose to `isaac@strum.us` was received by the recipient, but Dashboard Log showed Failed with:

> Cloudflare returned no delivered/queued recipients. The message may bounce asynchronously.

### Revert (`e8e0bdf`)

Restored fail-closed only when every recipient is in `permanent_bounces`. Empty disposition without bounces logs OK again. Real async failures still surface as Inbound Bounce rows.

### Bounce body fallback (`f61c266`, remains deployed)

On inbound store, if the message is a bounce and MIME text is empty, fill `bodyText` / preview from DSN diagnostics (minimum: `Bounce: delivery failed`).

## Deploy

- Worker: `relaybase-api` (`api.relaybase.xyz`)
- Revert Version ID: `e1026892-85b7-4c39-8f37-eec11e2fee2f`
- Date: 2026-08-10

## Verification

- [x] `pnpm run typecheck` in `server/`
- [x] `pnpm test:unit` in `app/` (33 tests)
- [x] Worker deploy succeeded (including revert)
- [x] Manual: successful send with empty disposition must not show Failed (strum.us case)
- [ ] Manual: new inbound bounce → body is not `(empty message)`

## Out of scope

- Retroactive rewrite of already-stored empty bounce rows in R2
- Correlating inbound bounce DSNs back to the original send log row
- Inlining the original `message/rfc822` attachment into bounce `bodyText`

## Related commits

- `f61c266` — D1 ops log, bounce detection / body fallback, Dashboard Log page
- `f3dc228` — Fail closed when CF Email Sending returns empty disposition (later reverted)
- `e8e0bdf` — Revert empty-disposition fail-closed heuristic
- See also: `2026-08-10-strum-us-missing-spf-blocks-inbound-to-cf.md` (unrelated inbound block from Google Workspace)
