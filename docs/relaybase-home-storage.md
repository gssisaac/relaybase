# Desktop storage — `~/.relaybase`

**Audience:** humans and coding agents changing desktop persistence, credentials, mail cache, sidebar UI state, or notifications.

**Source of truth (desktop):** `$HOME/.relaybase` only.  
Implemented in `desktop/src-tauri/src/secrets.rs`, `desktop/src-tauri/src/notify.rs`, and the TS facades under `app/src/email/*-disk*` / `email-prefs.ts` / `api-key-vault.ts`.

For the full two-layer model (Worker D1 + R2 + this directory), see **[storage-architecture.md](./storage-architecture.md)**.

---

## Rule (non-negotiable)

On the **Mac / Tauri desktop app**, durable user data **must** live under `~/.relaybase`.

| Allowed | Forbidden as durable store |
|---------|----------------------------|
| `~/.relaybase/**` via Tauri commands (`get_/save_credentials`, `get_/save_email_prefs`, `get_/save_mail_json`, `get_/save_api_key_vault*`) | WebKit / Application Support (`~/Library/WebKit/*`, `~/Library/Application Support/Relaybase*`) |
| | `localStorage` / `sessionStorage` for the `http://127.0.0.1:*` or `http://localhost:*` origin |
| | Ad-hoc paths under the repo (`data/`, `app/data/`, etc.) for desktop UX |
| | Keychain / other home dirs as a second source of truth (unless explicitly migrated later) |

`localStorage` may mirror disk for sync reads **after** hydrate. It is **not** the source of truth. Binary renames (`relaybase_desktop` → `Relaybase`) reset WebKit profiles and will look like “data wiped” if anything still depends on localhost storage alone.

Server/worker data (Cloudflare D1 + R2) is separate — that is the remote product store, not local desktop UX state.

---

## Directory layout

```text
~/.relaybase/                          # mode 0700
├── credentials.json                   # Cloudflare + Worker + Relaybase console account (0600; session, global)
├── team-login.json                    # team-user mobile password login (0600; session, global)
├── app-icon.png                       # notification identity image (global)
├── storage-layout-v2.json            # migration marker (version, migratedAt, scopeId, from)
└── {scopeId}/                         # opaque s-{16hex} SHA-256 prefix — no raw account id
    ├── email.json                     # account colors / email prefs (0600)
    ├── api-keys.json                  # plaintext API key vault (0600)
    ├── cache/                          # opaque dashboard/API response cache
    │   ├── favicon-status.json        # sender favicon ok/failed status (images stay memory-only)
    │   └── dashboard/
    │       ├── stats-{range}.json
    │       ├── api-keys-{range}.json
    │       ├── addresses-{domain}.json
    │       ├── ttl-*.json             # products-v1 TTL cache write-through
    │       └── …
    └── mail/
        └── desktop/                   # fixed local operator id
            ├── inbox.json             # accumulated inbox pages + nextBefore/hasMore + total/unread per domain
            ├── sent.json              # accumulated sent pages + nextBefore/hasMore/total per domain
            ├── drafts.json
            ├── details/
            │   └── {messageKey}.json
            └── ui/
                ├── enabled-accounts.json
                ├── sidebar.json
                ├── accounts.json
                ├── read.json
                └── trash.json
```

### Account scope id (`{scopeId}`)

Tenant-owned data (mail, cache, email prefs, API key vault) lives under
`~/.relaybase/{scopeId}/` so switching Cloudflare or Relaybase console
accounts isolates cache automatically. The `scopeId` is an **opaque SHA-256
prefix** — never the raw `relaybaseAccountId`, CF `accountId`, or `workerUrl`.

**Composition (priority order):**

1. `relaybaseAccountId` (console login)
2. CF `accountId` (CF OAuth)
3. (none — Worker-only scope)

**Hash input** (joined with `|`, fixed order, all normalized):

- Account part: first non-empty of the above, trimmed; empty string if none
- Worker part: normalized `workerUrl` (trim, strip trailing `/`, lowercase host) when set; empty string if not

```
hashInput = "{accountPart}|{workerPart}"
scopeId   = "s-" + hex(sha256(hashInput)).slice(0, 16)   # e.g. s-7f3a2b1e9c4d8012
```

Edge cases:

- Both empty (no credentials yet): `scopeId = "s-legacy"` (migration source only)
- Team users: worker part from `team-login.json` `workerUrl`; account part empty (Worker-only scope by design)

`{userId}` (the `desktop` / team-email segment under `mail/`) is always
`desktop` for the admin operator (cookie login removed). On first boot, any
legacy `mail/{oldCookieUser}/` folder is renamed to `mail/desktop/` when
`desktop` is missing — this runs **before** the v2 layout migration.

### Layout migration (v2)

`migrate_storage_layout_v2()` (Rust, idempotent) runs on boot via
`DesktopContext.refresh()`. If the marker file `storage-layout-v2.json`
exists, it is a no-op. Otherwise, legacy flat artifacts (`mail/`, `cache/`,
`email.json`, `api-keys.json` at the root) are **moved** into `{scopeId}/`
and the marker is written.

| Situation | Action |
|-----------|--------|
| First launch after upgrade | Move flat `mail/`, `cache/`, `email.json`, `api-keys.json` → `{scopeId}/` |
| CF / invite account switch | New `{scopeId}/` created empty; old folder retained |
| Same account reconnects same worker | Same `{scopeId}/` → data restored |
| Sign out | Clear `credentials.json` only; scoped folders remain |

On scope change, `DesktopContext` clears the in-memory session cache, all
scope-dependent `localStorage` mirrors, and the dashboard client cache
`Map` so stale data from the previous account does not bleed into the new
scope. Disk reads on the new scope return null automatically (Rust resolves
paths under the new `{scopeId}/`).

---

## File contracts

### `credentials.json`

Written by Rust (`secrets.rs`) or, in browser `pnpm next`, via `/api/local-credentials`. Shape (camelCase):

| Field | Purpose |
|-------|---------|
| `accountId` | Cloudflare account id (resolved from the OAuth flow) |
| `workerUrl` | Deployed Worker base URL |
| `adminToken` | Worker admin token (`ADMIN_TOKEN` wrangler secret or D1 recovery override; resettable via recovery) |
| `workerScriptName` | Wrangler script name |
| `workerVersion` | Deployed Worker bundle version |
| `relaybaseAccountId` | Relaybase console account id — written only when non-empty |
| `relaybaseEmail` | Relaybase console account email — written only when non-empty |
| `relaybaseSession` | Signed console session token (local only; Bearer to console APIs) — written only when non-empty |

Load strips any other key (including `installToken`, `serverToken`, `licenseKey`, `cfOauth*`) and rewrites the file to this allowlist. CF OAuth access/refresh tokens live in Tauri process memory only (`CF_OAUTH_SESSION` in `desktop/src-tauri/src/secrets.rs`) and are cleared on app restart. Paste-and-push of `CF_API_TOKEN` is one-shot — the token is never stored on disk. CF OAuth for the install token is documented in **[cf-oauth-install-token.md](./cf-oauth-install-token.md)**.

### `team-login.json`

Team-user login (per-account mobile password; separate from admin credentials). Written by Rust (`secrets.rs`).

| Field | Purpose |
|-------|---------|
| `workerUrl` | Customer Worker base URL |
| `accountEmail` | The teammate's account email |
| `mobilePassword` | Per-account mobile password (same model as the Flutter companion) |

### `email.json`

Path: `~/.relaybase/{scopeId}/email.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `accountColors` | `{ [email]: "#RRGGBB" }` |

TS: `app/src/email/lib/prefs/email-prefs.ts` → `get_email_prefs` / `save_email_prefs`.

### `mail/desktop/ui/accounts.json`

Path: `~/.relaybase/{scopeId}/mail/desktop/ui/accounts.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `expandedDomains` | Domain names whose Accounts cards are expanded (default all collapsed) |

TS: `app/src/console/pages/accounts/accounts-ui-state.ts` → `readUiJson` / `writeUiJson`.

### `api-keys.json`

Path: `~/.relaybase/{scopeId}/api-keys.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `entries[]` | `{ id, domain, label, apiKey, createdAt }` plaintext secrets |

Worker KV stores only key hashes. Plaintext is captured once at create/rotate and kept locally. TS: `app/src/lib/desktop/api-key-vault.ts`.

### `mail/desktop/*.json`

Path: `~/.relaybase/{scopeId}/mail/desktop/*.json`. Opaque JSON via `get_mail_json` / `save_mail_json`.

### `cache/**`

Path: `~/.relaybase/{scopeId}/cache/**`. Opaque JSON via `get_cache_json` / `save_cache_json`. Includes dashboard envelopes (`dashboard-cache-disk.ts`), TTL write-through (`dashboard-client-cache.ts` → `dashboard/ttl-*.json`), and sender favicon **status** (`favicon-status.json` — image bytes stay memory-only; see **[sender-favicon-cache.md](./sender-favicon-cache.md)**).

#### `cache/favicon-status.json`

| Field | Meaning |
|-------|---------|
| `version` | `1` |
| `domains.{domain}.ok` | `true` = proxy returned a data URL; `false` = confirmed no favicon |
| `domains.{domain}.at` | Unix ms when status was recorded |

Failed domains are not re-probed for 24h. Transient fetch errors are not written here. TS: `app/src/email/stores/sender-icon-store.ts`.

---

## Read / write flow (desktop)

```text
UI / store
  → write*: dual-write local mirror (optional) + required desktopSave*
  → hydrate*: desktopGet* first; if disk empty and legacy localStorage has data, migrate up once
```

1. **Write (desktop):** must succeed on `~/.relaybase`. Failure must surface — do not pretend success after only writing `localStorage`.
2. **Read (desktop):** prefer disk. Use `localStorage` only as a warm cache or one-time migration source.
3. **Browser `pnpm next`:** credentials via `/api/local-credentials` → same `~/.relaybase/credentials.json`; API calls go to the Worker through `desktopAwareFetch`.

Related: [last-route-restore.md](./last-route-restore.md) (sidebar paths live in `ui/sidebar.json`).

---

## Agent checklist

When adding durable desktop state:

1. Put it under `~/.relaybase/{scopeId}/` (usually `mail/desktop/ui/…`, `cache/…`, or extend `email.json` / `api-keys.json` with a Rust schema change). **Never** write tenant data at the `~/.relaybase/` root — only session files (`credentials.json`, `team-login.json`, `app-icon.png`, `storage-layout-v2.json`) live there.
2. **Never** use raw `relaybaseAccountId`, CF `accountId`, or `workerUrl` as a folder name. The `scopeId` is an opaque SHA-256 prefix resolved by Rust (`resolve_account_scope_id`).
3. Go through existing Tauri commands — do **not** open ad-hoc files from the Next.js layer (except `/api/local-credentials` for browser next).
4. Do **not** invent a second store in Application Support, Keychain, or `localhost` `localStorage`.
5. Hydrate from disk on boot; migrate legacy `localStorage` keys once if present.
6. TTL API caches may mirror in `localStorage` but must also write through to `~/.relaybase/{scopeId}/cache/…` on desktop.
7. On account-scope change, clear scope-dependent `localStorage` mirrors (`clearScopeDependentLocalStorage`) and the dashboard client cache `Map` (`clearAllDashboardClientCache`) so stale data does not bleed across accounts.
