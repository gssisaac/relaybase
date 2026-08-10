# Send log false positive when Cloudflare returns empty disposition

**Date:** 2026-08-10  
**Status:** Fixed and deployed  
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

### 1. Send routes treated empty disposition as success

Cloudflare Email Sending returns per-recipient disposition arrays:

- `delivered`
- `queued`
- `permanent_bounces`

Asynchronous bounces do **not** appear in the synchronous send response. They arrive later as inbound DSN mail from `bounces@cf-bounce.*`.

Both `/admin/send` (compose) and `/v1/send` (API) only failed closed when:

```ts
delivered.length === 0 && queued.length === 0 && permanentBounces.length > 0
```

When Cloudflare returned HTTP 200 / `success: true` with **all three arrays empty**, the Worker logged `ok: true` and returned 200 to the client. LogsView renders OK/Failed from `log.ok`, so the dashboard showed a green OK next to an empty disposition payload.

### 2. Bounce DSN body looked empty before fallback was live

CF bounce MIME is typically `multipart/report`. `postal-mime` extracts top-level `text/plain` only, so DSN bodies often parse as empty. Bounce detection + `buildBouncePreview()` fallback had already been added in the ops-log commit, but until Worker deploy the production inbox still showed `(empty message)`.

## Fix

### Logging (`f3dc228`)

Introduced `noDisposition` (`delivered` and `queued` both empty):

- Log `kind: "send"` with **`ok: false`** and an error explaining empty disposition / possible async bounce.
- Keep **HTTP 200** for compose/API clients when there are no synchronous `permanent_bounces` (compose still upserts Sent).
- Keep **HTTP 502** when all recipients are in `permanent_bounces`.

### Bounce body fallback (prior commit `f61c266`, deployed with this fix)

On inbound store, if the message is a bounce and MIME text is empty, fill `bodyText` / preview from DSN diagnostics (minimum: `Bounce: delivery failed`).

## Deploy

- Worker: `relaybase-api` (`api.relaybase.xyz`)
- Version ID: `5846ea8c-106f-460b-bed1-a870cc8e092b`
- Date: 2026-08-10

## Verification

- [x] `pnpm run typecheck` in `server/`
- [x] `pnpm test:unit` in `app/` (33 tests)
- [x] Worker deploy succeeded
- [ ] Manual: compose send that yields empty disposition → Log Send row shows **Failed**
- [ ] Manual: new inbound bounce → body is not `(empty message)`

## Out of scope

- Retroactive rewrite of already-stored empty bounce rows in R2
- Correlating inbound bounce DSNs back to the original send log row
- Inlining the original `message/rfc822` attachment into bounce `bodyText`

## Related commits

- `f61c266` — D1 ops log, bounce detection / body fallback, Dashboard Log page
- `f3dc228` — Fail closed when CF Email Sending returns empty disposition
