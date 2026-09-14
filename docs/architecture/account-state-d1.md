# Account state D1 — `account_state` + `draft_attachments`

**Audience:** humans and coding agents changing sidebar/UI persistence, compose drafts, account colors/signatures, broadcast drafts-in-progress, or anything that used to live only under `~/.relaybase/{scopeId}/*` and needs to work on the **web** build (web owner console or web/mobile "email" mode), not just desktop.

**Rule:** durable per-account state that isn't mail-index data (see [`mailbox-d1.md`](./mailbox-d1.md)) and isn't plaintext-secret data (API key vault stays desktop-local, see *Forbidden* below) lives in D1 `RELAYBASE_DB`, table `account_state` (+ `draft_attachments` for attachment metadata, bytes in R2). Desktop keeps `~/.relaybase` as an offline-fast-path mirror; **the Worker is the cross-device source of truth**. This is what makes sidebar state, read/trash state, drafts, and account colors work on a browser at all — before this, the web build had **no server-side persistence** for any of it (browser-only `localStorage`, gone on cache clear or a second device).

This doc is the D1/Worker/client-port reference. For the local disk side (`~/.relaybase` tree, Tauri commands, `localStorage` mirror rules) see [`home-storage.md`](../desktop/home-storage.md). For the two-layer model overview see [`storage-architecture.md`](./storage-architecture.md).

**Primary code:**

| Area | Paths |
|------|------|
| D1 schema + migration | `../relaybase-worker/db/app/schema.ts` (`accountState`, `draftAttachments`), `../relaybase-worker/db/migrations.ts` (`APP_0001`) |
| D1 helpers | `../relaybase-worker/db/app/account-state.ts` |
| Identity resolution | `../relaybase-worker/src/lib/account-identity.ts` (`resolveAccountIdentity`, `foldMobileIdentity`) |
| Namespace/key allow-list + R2 wrapper | `../relaybase-worker/src/lib/account-state.ts` |
| Shared route implementation | `../relaybase-worker/src/routes/account-state-router.ts` |
| Owner-session mount | `../relaybase-worker/src/routes/mail/account-state.ts` → `/mail/account-state/*` |
| Mobile-password mount | `../relaybase-worker/src/routes/mobile.ts` → `/mobile/account-state/*` |
| Broadcast drafts (owner-only singleton) | `../relaybase-worker/src/routes/console/broadcast-drafts.ts` → `/console/broadcast-drafts` |
| Client path mapping | `app/src/lib/desktop/api/email-api-map.ts` (desktop/web-console), `app/src/mail-platform/transport/map-email-mobile.ts` (web/mobile "email" mode) |
| Client port (no React needed) | `app/src/mail-platform/account-state.ts` |
| Wired call sites | `app/src/email/lib/disk/user-ui-disk.ts`, `app/src/email/lib/prefs/email-prefs.ts`, `app/src/email/lib/disk/email-disk-store.ts` (drafts only), `app/src/email/lib/attachments/draft-attachment-store.ts`, `app/src/lib/dashboard/broadcast-drafts-disk.ts` |
| Desktop→Worker one-time backfill (TypeScript, not Rust) | `app/src/lib/desktop/account-state-migration.ts` (+ pure logic in `account-state-migration-logic.ts`), triggered from `app/src/email/stores/mail-accounts-store.ts` |

Read this before adding a new durable UI-state file, before changing what `readUiJson`/`writeUiJson` persist, or before assuming "web" has no server-side storage for something under `~/.relaybase`.

---

## Why this exists

The web build (browser tab, no Tauri, no OS filesystem) cannot read or write `~/.relaybase`. Before this subsystem, every file under `mail/desktop/ui/*.json`, `email.json`, `drafts.json`, and `broadcast-drafts.json` was **desktop-only on disk**; the web build silently fell back to plain browser `localStorage` with no server copy — sidebar collapse state, read/trash state, drafts, and account colors were per-browser and vanished on a cleared cache or a second device.

`account_state` is a **generic scoped key-value table**, not one table per file. These files are already treated as opaque JSON blobs by the desktop Tauri bridge (`get_mail_json`/`save_mail_json`) — the Worker never needs to query *inside* `sidebar.json`. A purpose-built table per file (7+ tables) would be pure boilerplate for zero query benefit; a generic table lets a new UI-state file ship with no new migration.

### Explicitly out of scope (do not move these here)

- **`workspaces.json` / `team-login.json`** — these are the local "which Worker/account am I even pointed at" bootstrap pointer. A single Worker's D1 cannot hold "the list of every Worker this Mac has connected to," and the web build only ever has one Worker (baked in at deploy time via `window.__RELAYBASE_WORKER_URL__`), so there's no equivalent concept to sync. Stays desktop-local, unchanged. See [`home-storage.md`](../desktop/home-storage.md) → `workspaces.json`.
- **`api-keys.json` plaintext vault** — moving plaintext API keys into D1 is a security regression the storage-architecture *Forbidden* list already rules out; the Worker only ever stores hashes. Desktop keeps its local plaintext vault; web uses the existing hash-only `api_keys` table + reveal-once-at-creation flow. Not touched by this subsystem.
- **Auth/session tokens** (owner passtoken, access/refresh tokens, mobile passwords) — desktop keeps OS-keyring storage; web keeps access tokens in JS memory, owner refresh tokens and teammate mobile passwords in tab `sessionStorage`, and never stores the passtoken (see [`authentication.md`](../auth/authentication.md) → *Web owner session*). This is a deliberate security trade-off (see [`authentication.md`](../auth/authentication.md)), not something this migration should touch.
- **`inbox.json` / `sent.json` / `details/*.json`** — cache tier, fully rebuildable from D1 `RELAYBASE_MAIL` + R2. Web already has full parity for these via `mail-platform/storage/web-storage.ts` (localStorage + IndexedDB) and `dashboard-cache-disk.ts` / `sender-icon-store.ts` (localStorage fallback). No D1 needed; see *Cache tier* below.

---

## Schema

```ts
export const accountState = sqliteTable("account_state", {
  id: text("id").primaryKey(),           // `${identityKey}:${namespace}:${key}`
  identityKey: text("identity_key").notNull(), // "owner" | "team:{email}"
  namespace: text("namespace").notNull(),       // "ui" | "prefs" | "mail" | "broadcast"
  key: text("key").notNull(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  uniqueIndex("account_state_identity_ns_key_idx").on(t.identityKey, t.namespace, t.key),
  index("account_state_identity_idx").on(t.identityKey),
]);

export const draftAttachments = sqliteTable("draft_attachments", {
  id: text("id").primaryKey(),                  // `${identityKey}:${draftId}:${attachmentId}`
  identityKey: text("identity_key").notNull(),
  draftId: text("draft_id").notNull(),
  attachmentId: text("attachment_id").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  size: integer("size").notNull(),
  r2Key: text("r2_key").notNull(),              // drafts/{identityKey}/{draftId}/{attachmentId}
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("draft_attachments_identity_draft_attach_idx").on(t.identityKey, t.draftId, t.attachmentId),
  index("draft_attachments_identity_draft_idx").on(t.identityKey, t.draftId),
]);
```

Migration `APP_0001` (`db/migrations.ts`) is embedded and applied only via **`POST /console/migrate-db`** — same rule as every other D1 change on this Worker: **never** raw `wrangler d1 execute`. See [`d1-migrations-and-init-db.md`](./d1-migrations-and-init-db.md).

Attachment **bytes** are not in D1 — they're PUT into the existing R2 bucket `relaybase-mailbox` (binding `INBOUND`) under a new `drafts/{identityKey}/{draftId}/{attachmentId}` prefix, sibling to `inbound/` and `sent/` (see [`mailbox-r2.md`](./mailbox-r2.md)). The inbound-retention cron only walks `inbound/{domain}`, so it never touches `drafts/`. There is currently **no TTL/sweep** for orphaned draft attachments whose parent draft was deleted without going through `deleteAttachmentsDir` — a known gap, see *Known gaps* below.

---

## Identity scoping (`identityKey`)

Each Worker is single-tenant (one owner + N invited teammates), so rows are scoped by **who is calling**, not by the desktop's opaque `scopeId` (that hash only exists to disambiguate *which of several Workers'* data lives on one shared Mac disk — irrelevant once you're inside one Worker's own D1).

`resolveAccountIdentity(c, scope)` (`worker/src/lib/account-identity.ts`):

1. Try `requireOwnerSession(c, scope)` (owner bearer token) → `identityKey = "owner"`.
2. On failure, try `requireMobilePassword(c)` (per-account mobile password) → resolve via `foldMobileIdentity`:
   - If the authenticated email matches `owner_config.ownerEmail` (case-insensitive) → **fold to `"owner"`**.
   - Otherwise → `identityKey = "team:{email}"`.

**Why the folding step exists:** the owner can also authenticate via mobile-password when using the plain web-mail build (`mail-platform/types.ts` calls this out explicitly — "an owner using the web build also lands in `email` mode"). Without folding, the owner's own UI state would split into a separate `team:{ownerEmail}` bucket instead of the `"owner"` bucket their desktop/console session writes to, and sidebar/drafts/etc. would silently disagree between the owner's desktop and their own web-mail tab.

> **Trust-boundary note:** this folding step means a mobile-password holder whose email matches `owner_config.ownerEmail` gets owner-scoped `account_state` rows, not just owner-scoped mail. This is intentional (it's the same person), but it is a deliberate widening worth remembering if the mobile-password auth surface ever changes.

`/mobile/account-state/*` reuses the email already authenticated by `mobile.use("*", requireMobilePassword)` (via `foldMobileIdentity(c.env, c.get("authEmail"))`) rather than re-running auth — see `worker/src/routes/mobile.ts`.

---

## Namespace / key allow-list

`worker/src/lib/account-state.ts` exports `ACCOUNT_STATE_KEYS`, the only `(namespace, key)` pairs the **shared** `/mail/account-state` and `/mobile/account-state` endpoints accept:

| Namespace | Keys | Replaces (`~/.relaybase/{scopeId}/…`) |
|-----------|------|----------------------------------------|
| `ui` | `enabled-accounts.json`, `available-addresses.json`, `sidebar.json`, `accounts.json`, `read.json`, `trash.json`, `compose-contacts.json` | `mail/desktop/ui/*.json` |
| `prefs` | `email.json` | `email.json` (account colors / signatures) |
| `mail` | `drafts.json` | `mail/desktop/drafts.json` (unsent compose drafts only — **not** `inbox.json`/`sent.json`/`details/*.json`, which stay cache-only) |

`GET`/`PUT`/`DELETE /mail/account-state/:namespace/:key` (and the `/mobile/...` mirror) 404 on anything not in this list — it is **not** a general-purpose KV write primitive.

> **Keep this list in sync by hand.** `main/app` (`UI_FILES` in `user-ui-disk.ts`, plus the literal `"email.json"` / `"drafts.json"` keys used at each call site) and `worker` (`ACCOUNT_STATE_KEYS`) are separate packages, not in the same build graph — there is no shared import between them today. Adding a new durable UI-state file means editing **both** lists. If the monorepo ever grows a shared types package, this is the first thing that should move into it.

**`broadcast` is deliberately absent from `ACCOUNT_STATE_KEYS`** — see the next section. It still uses the same `account_state` table (namespace `broadcast`, key `broadcast-drafts.json`, `identityKey` fixed to `"owner"`), just through a route that bypasses this allow-list entirely.

### Broadcast drafts: same table, a separate route, not in the shared allow-list

Broadcast composing is owner/console-only (`requireConsoleSession`). It is **not** reachable through `/mail/account-state` or `/mobile/account-state` at all — `/console/broadcast-drafts` (`worker/src/routes/console/broadcast-drafts.ts`) calls `readAccountState`/`writeAccountState` (the low-level D1 helpers) **directly**, never going through `isAllowedAccountStateKey`/`ACCOUNT_STATE_KEYS`.

This split exists because of a real bug caught during live testing (see *Verification performed*): `broadcast` was originally *included* in `ACCOUNT_STATE_KEYS`, which meant the shared router's `isAllowedAccountStateKey` check happily accepted `namespace: "broadcast"` — so a mail-scoped owner bearer token (via `/mail/account-state/broadcast/broadcast-drafts.json`) or any teammate's mobile password (via the `/mobile/...` mirror) could read/write the same `identityKey="owner"` row the console-only feature manages, completely bypassing `requireConsoleSession`. Removing `broadcast` from `ACCOUNT_STATE_KEYS` closed that hole with no effect on the legitimate path, since the console route never consulted that list to begin with. **Do not add `broadcast` back to `ACCOUNT_STATE_KEYS`** — if broadcast composing ever opens up to teammates, give it proper per-identity scoping through a deliberate design pass, not by re-adding it to this shared list.

---

## HTTP surface

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /mail/account-state/:namespace/:key` | owner bearer (`resolveAccountIdentity(c, "mail")`) | Read one JSON value → `{ value, updatedAt }` (`{ value: null, updatedAt: null }` on miss) |
| `PUT /mail/account-state/:namespace/:key` | owner bearer | Upsert `{ value }` |
| `DELETE /mail/account-state/:namespace/:key` | owner bearer | Delete one value |
| `GET/PUT/DELETE /mail/account-state/drafts/:draftId/attachments/:attachmentId` | owner bearer | Attachment bytes. `PUT` body is `{ filename, contentType, contentBase64 }` — **not** a raw binary body, see *Why base64* below |
| `DELETE /mail/account-state/drafts/:draftId/attachments` | owner bearer | Delete every attachment for one draft (list-by-`(identityKey, draftId)` + batch delete) |
| `POST /mail/account-state/bulk-import` | owner bearer | One-time migration upload (see *Migrating existing desktop users* below) |
| `/mobile/account-state/*` | mobile password (`foldMobileIdentity`) | Identical route set, mounted under `/mobile` for teammates + web "email" mode |
| `GET/PUT /console/broadcast-drafts` | `requireConsoleSession` | Owner-only broadcast-draft singleton (`identityKey` fixed to `"owner"`) |

### Why base64, not a raw binary request body

The desktop Tauri invoke bridge (`worker_request` → `desktopWorkerRequest`) carries a **string** request body only (see `lib/desktop/api/worker-api.ts` — `DesktopWorkerResponse` reconstructs the response from a base64 string, and the request path stringifies whatever it's given). Sending an `ArrayBuffer` through that channel would serialize to garbage (`String(arrayBuffer)` → `"[object ArrayBuffer]"`). So every write path that must work from **both** the browser and the Tauri webview uses base64-in-JSON — same convention already used elsewhere in this codebase for attachment bytes (`resolveSendAttachments`'s `contentBase64` field, `desktopSaveMailBinary`). The **response** side (`GET .../attachments/:id`) stays raw binary — the Tauri bridge already base64-encodes *any* response body transparently and reconstructs a real `Response` client-side, so there's no equivalent constraint there.

---

## Client wiring

### Why no React context is needed

`user-ui-disk.ts`, `email-prefs.ts`, `email-disk-store.ts`, `draft-attachment-store.ts`, and `broadcast-drafts-disk.ts` are all plain (non-hook) modules called from stores and event handlers, not React components — they never had access to `useMailRuntime()`. Rather than thread the `MailRuntime` context through all of them, the account-state client (`app/src/mail-platform/account-state.ts`) calls the same plain, already-React-free `desktopAwareFetch("/api/email/...")` that `createConsoleTransport()` wraps — it already resolves to the right Worker surface with zero React dependency:

- **Desktop:** `desktopAwareFetch` → Tauri invoke (`desktopWorkerRequest`) → owner bearer → `/mail/account-state`.
- **Web owner console** (`WebConsoleAppProviders`, reuses `createConsoleTransport()` as-is): `desktopAwareFetch` → plain `fetch` with an in-memory Bearer token (`ensureAccessToken`) → `/mail/account-state`.
- **Web/mobile "email" mode** (`EmailAppProviders` / Flutter-style team login): `desktopAwareFetch` detects `getWebTeamAuth()` (a module-level global backed by `window.__RELAYBASE_TEAM_AUTH__` + `sessionStorage`, from `mail-platform/session/email-session.ts`) and routes to `/mobile/account-state` instead.

This means `mail-platform/account-state.ts` has **no desktop/web branching of its own** for the network call — `desktopAwareFetch` already does it. The path mapping lives in two small map files, mirroring every other `/api/email/*` route:

- `lib/desktop/api/email-api-map.ts`: `/api/email/account-state/*` → `/mail/account-state/*`, `/api/email/broadcast-drafts` → `/console/broadcast-drafts`.
- `mail-platform/transport/map-email-mobile.ts`: `/api/email/account-state/*` → `/mobile/account-state/*` (broadcast-drafts is intentionally **not** mapped here — console-only).

### Read/write policy per platform

| | Desktop | Web (console or email mode) |
|---|---------|------------------------------|
| **Read** | Disk first (unchanged behavior — no regression risk). Falls back to `localStorage` mirror on disk miss. | Worker first (`fetchAccountStateJson`). Falls back to `localStorage` mirror on Worker miss/offline. |
| **Write** | Disk first (unchanged — still the thing that must succeed), then a **best-effort** fire-and-forget mirror to the Worker (`.catch(() => {})` — a slow/offline Worker must never block or fail a desktop save). | `localStorage` mirror written first (survives a flaky network), then `await` the Worker write and **let failures propagate** — callers already wrap these calls in their own `.catch()` (e.g. `writeEnabledAccounts` in `enabled-accounts.ts`). |

**Draft attachments are the one deliberate exception** to "web writes throw on Worker failure": `ingestFilesAsAttachments` in `ingest-attachment.ts` turns any thrown error into a user-facing "Failed to add {file}" message mid-compose. Failing an attach because of a transient network blip would be a worse regression than accepting "not yet synced to the server." So on web, `saveDraftAttachmentBytes` writes to IndexedDB (unchanged, immediate) and does the Worker upload **best-effort** (swallowed + logged), never blocking the attach itself. `loadDraftAttachmentBytes` still prefers the local IndexedDB copy and falls back to a Worker fetch (mirroring the result back into IndexedDB) only on a local miss.

This is why the "web: Worker is the sole source of truth, no local fallback" framing from the original migration plan doesn't quite apply to attachment bytes specifically — for attachments, IndexedDB is deliberately kept as the primary write target on web, with the Worker as a best-effort durability upgrade layered on top, not a hard dependency.

### Cache tier — already had web parity, untouched by this work

`dashboard-cache-disk.ts`, `dashboard-client-cache.ts`, `sender-icon-store.ts`, and `mail-platform/storage/web-storage.ts` already branch on `isDesktopRuntime()` with a full `localStorage`/IndexedDB fallback and were **not** touched by this subsystem — they're fully rebuildable from the Worker so there's no correctness reason to add a D1 leg. `user-ui-disk.ts`, `email-disk-store.ts` (only the `drafts.json` half), `broadcast-drafts-disk.ts`, and `dashboard-cache-disk.ts` each hand-roll a near-identical `localKey()`/`readLocalJson()`/`writeLocalJson()` block (same `relaybase:mail:v1:{path}` key scheme). Consolidating that into one shared helper is a real but low-risk cleanup opportunity, independent of this migration — not done here to keep this change reviewable.

---

## Migrating existing desktop users

Existing desktop installs have historical state only on disk (`~/.relaybase/{scopeId}/...`), with nothing yet in D1 for their account. `POST /mail/account-state/bulk-import` (upsert-only, idempotent — safe to retry) handles the one-time upload.

**Implemented as TypeScript, not Rust**, despite the original plan assuming a Rust routine mirroring `migrate_storage_layout_v2()`. The backfill needs a live authenticated Worker call, which only exists in the JS layer (`desktopAwareFetch`) — Rust's storage module has no HTTP client or auth token, so putting this logic in Rust would have meant duplicating the JS auth/fetch stack in Rust for no benefit. Instead:

- `app/src/lib/desktop/account-state-migration.ts` — `runAccountStateBackfillOnce()`. Checks a marker (`desktopGetMailJson("account-state-migrated-v1.json")` → resolves to `~/.relaybase/{scopeId}/mail/account-state-migrated-v1.json`, **not** the scope root as an earlier draft of this doc said — there's no generic "write JSON at scope root" Tauri command, only the `mail/`-scoped and `cache/`-scoped ones). If unmigrated: reads all `ui/*.json` files + `email.json` + `drafts.json` from disk, `POST`s them via `bulk-import`, uploads every `origin: "local"` draft attachment's bytes (`origin: "source"` attachments are references into existing mail, never had local bytes), best-effort uploads `broadcast-drafts.json` via `/console/broadcast-drafts` (failure here doesn't block the rest), then writes the marker **only if everything else succeeded**.
- Triggered from `app/src/email/stores/mail-accounts-store.ts`, specifically inside `refreshAddresses()`'s success branch (`res.ok` after `GET /mail/addresses?all=1`) — this is the first point in the owner-mode boot sequence where a *live, authenticated* Worker call is confirmed working, not just credentials loaded. Also fired from the team-mode seed path in `runPrimaryBootstrap()`, though team mode has no equivalent "proven live auth" signal in this store, so that call site can occasionally fire before a token is ready — harmless, since a failed attempt just retries next time this function is called (no marker written on failure, `inFlight` guard prevents overlapping runs).
- Pure, mockable logic (marker validation, drafts-array extraction, `origin: "local"` filtering) lives in `account-state-migration-logic.ts` and is unit-tested in `account-state-migration-logic.test.ts` — the orchestration function itself is not unit-tested (it has no dependency-injection seam, consistent with how every other bridge-dependent module in this codebase is verified via the running app, not `node:test`).

---

## Verification performed

Live end-to-end verification was run against a fully **local** `wrangler dev` (Miniflare-emulated D1/R2, `account_id`/`database_id` in `wrangler.local.toml` are placeholders in this mode — nothing remote/production was touched) with a fresh owner + a real teammate:

- `POST /console/init-db` applied `0001_burly_titania` cleanly alongside every pre-existing migration.
- Full `/mail/account-state` CRUD round-trip (GET/PUT/DELETE), 404 on an unlisted key, 401 with no/garbage bearer token.
- `POST /mail/account-state/bulk-import`: valid items imported, an item with an unlisted namespace correctly reported in `skipped`, not written.
- Draft attachment PUT (base64 JSON) → GET (raw binary) round-trip byte-for-byte; single-attachment DELETE; whole-draft `DELETE .../attachments` removes every object.
- `/console/broadcast-drafts`: 401 with a mail-scoped token (as intended — needs a console-scoped token), works with a real console-scoped token.
- **Identity folding, the highest-risk piece of this design:** with `owner_config.owner_email = "owner@example.com"`, a mobile-password login as `owner@example.com` reads/writes the *exact same* `identityKey="owner"` row the mail-scoped bearer token uses (bidirectionally — a write via one auth path is immediately visible via the other), case-insensitively. A different teammate (`bob@example.com`) is fully isolated in `identityKey="team:bob@example.com"` and never sees or affects the owner's data. Wrong password and missing `X-Account-Email` both 401 correctly.

**This verification pass itself found and fixed one real bug** (not a hypothetical — see *Known gaps* history below): `broadcast` was originally included in the shared `ACCOUNT_STATE_KEYS` allow-list, which made the owner-only `broadcast-drafts.json` singleton reachable through `/mail/account-state` with a mere mail-scoped token, and through `/mobile/account-state` with any teammate's mobile password — bypassing the `requireConsoleSession` gate the dedicated `/console/broadcast-drafts` route enforces. Fixed by removing `broadcast` from `ACCOUNT_STATE_KEYS` (the console route calls the DB helpers directly and never consulted that allow-list to begin with, so the fix has zero effect on the legitimate path). This is exactly the kind of boundary bug that's invisible from reading either route in isolation — worth remembering before adding another namespace to the shared allow-list.

What **wasn't** covered by this pass: an actual **deployed** Worker (this was local Miniflare, not `wrangler deploy`), the real Tauri desktop binary (no Rust code changed, so this is lower-risk, but the JS↔Tauri-invoke boundary for `desktopAwareFetch`'s desktop branch was not exercised), and the `runAccountStateBackfillOnce()` orchestration function end-to-end (its pure sub-logic is unit-tested; the full flow needs an actual desktop app with real historical `~/.relaybase` files to migrate).

---

## Known gaps (as of this writing)

- **No R2 TTL/sweep for orphaned draft attachments.** If a draft is deleted without going through `deleteAttachmentsDir` (bug, crash, direct DB manipulation), its R2 objects under `drafts/{identityKey}/{draftId}/**` are never cleaned up. Consider a cron pass similar to the inbound-retention cron.
- **The backfill trigger has not been exercised against a real desktop app with real historical data** — only its pure sub-logic is unit-tested, and the live E2E pass above used a fresh install with no pre-existing `~/.relaybase` files to migrate. Test this explicitly on an existing install before shipping: confirm the marker path, confirm attachments upload, confirm the marker is not written on a partial failure.
- **No deployed-Worker or packaged-desktop-app verification.** Everything above was `wrangler dev --local` (Miniflare) plus a running `next dev` boot check — not a `wrangler deploy` or a built `.app`.
- **`(namespace, key)` allow-list duplication** between `worker/src/lib/account-state.ts` and `main/app`'s `UI_FILES` (+ scattered literal keys) is manual — no shared package enforces it stays in sync. The `broadcast` bug above is a concrete example of what goes wrong when this list is edited casually — treat every addition to `ACCOUNT_STATE_KEYS` as a security review, not just a feature addition.

---

## Checklist when changing this area

- [ ] New durable per-mail-identity (owner **or** team) JSON file → add `(namespace, key)` to **both** `worker/src/lib/account-state.ts`'s `ACCOUNT_STATE_KEYS` and the corresponding `main/app` call site (and `UI_FILES` if it's a `ui/*.json` file). Neither list is generated from the other. If instead the new state is **owner/console-only** (like broadcast drafts), do **not** add it to `ACCOUNT_STATE_KEYS` — give it its own dedicated route that calls `readAccountState`/`writeAccountState` directly with a fixed `identityKey="owner"`, following `console/broadcast-drafts.ts`.
- [ ] Never put mail-index data (things `RELAYBASE_MAIL`/`mailbox_messages` already covers) or cache-tier data (rebuildable from the Worker) into `account_state` — it's for state with **no other server representation**.
- [ ] Never put plaintext secrets in `account_state` — `api-keys.json` stays desktop-local by policy (see *Explicitly out of scope*).
- [ ] Any new write path shared between the Tauri webview and the browser must send binary payloads as base64-in-JSON, not a raw request body (Tauri invoke only carries strings).
- [ ] Desktop reads/writes must not regress: disk stays first for reads, disk write must still be the thing that "must succeed" — the Worker mirror is additive and must never block or fail a desktop save.
- [ ] Migrations: embed in `worker/db/migrations.ts` and apply only via `POST /console/migrate-db` — never raw `wrangler d1 execute` (see [`d1-migrations-and-init-db.md`](./d1-migrations-and-init-db.md)).
- [ ] If you exercise `runAccountStateBackfillOnce()` against a real existing install (not yet done — see *Known gaps*), update *Verification performed* with the result.
