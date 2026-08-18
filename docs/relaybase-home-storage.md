# Desktop storage — `~/.relaybase`

**Audience:** humans and coding agents changing desktop persistence, credentials, mail cache, sidebar UI state, or notifications.

**Source of truth (desktop):** `$HOME/.relaybase` only.  
Implemented in `desktop/src-tauri/src/secrets.rs`, `desktop/src-tauri/src/notify.rs`, and the TS facades under `app/src/email/*-disk*` / `email-prefs.ts` / `api-key-vault.ts`.

For the full two-layer model (Worker KV `RELAYBASE_APP` + this directory), see **[storage-architecture.md](./storage-architecture.md)**.

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

Server/worker data (Cloudflare KV `RELAYBASE_APP`, R2, D1 waitlist) is separate — that is the remote product store, not local desktop UX state.

---

## Directory layout

```text
~/.relaybase/                      # mode 0700
├── credentials.json               # Cloudflare + Worker + Relaybase console account (0600)
├── team-login.json                # team-user mobile password login (0600; admin-less)
├── email.json                     # account colors / email prefs (0600)
├── api-keys.json                  # plaintext API key vault (0600)
├── app-icon.png                   # notification identity image (seeded from bundle)
├── cache/                         # opaque dashboard/API response cache
│   └── dashboard/
│       ├── stats-{range}.json
│       ├── api-keys-{range}.json
│       ├── addresses-{domain}.json
│       ├── ttl-*.json             # products-v1 TTL cache write-through
│       └── …
└── mail/
    └── desktop/                   # fixed local operator id
        ├── inbox.json             # accumulated inbox pages + nextBefore/hasMore per domain
        ├── sent.json
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

`{userId}` is always `desktop` (cookie login removed). On first boot, any legacy `mail/{oldCookieUser}/` folder is renamed to `mail/desktop/` when `desktop` is missing.

---

## File contracts

### `credentials.json`

Written by Rust (`secrets.rs`) or, in browser `pnpm next`, via `/api/local-credentials`. Shape (camelCase):

| Field | Purpose |
|-------|---------|
| `accountId` | Cloudflare account (for optional zone/Email assist) |
| `apiToken` | Cloudflare API token (used by Tauri auto-install + zone assist; never sent to Relaybase) |
| `workerUrl` | Deployed Worker base URL |
| `adminToken` | Worker admin token (wrangler secret OR KV `srv:config:admin`; resettable via recovery) |
| `workerScriptName` | Wrangler script name |
| `licenseKey` | License key (legacy; verify now via `console.relaybase.xyz`) |
| `relaybaseAccountId` | Relaybase console account id (`console.relaybase.xyz`) |
| `relaybaseEmail` | Relaybase console account email |
| `relaybaseSession` | Signed console session token (stored locally; sent as `Authorization: Bearer` to console APIs) |
| `relaybaseTier` | License tier mirrored from the console (`free` / `pro`) |

### `team-login.json`

Team-user login (per-account mobile password; separate from admin credentials). Written by Rust (`secrets.rs`).

| Field | Purpose |
|-------|---------|
| `workerUrl` | Customer Worker base URL |
| `accountEmail` | The teammate's account email |
| `mobilePassword` | Per-account mobile password (same model as the Flutter companion) |

### `email.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `accountColors` | `{ [email]: "#RRGGBB" }` |

TS: `app/src/email/email-prefs.ts` → `get_email_prefs` / `save_email_prefs`.

### `mail/desktop/ui/accounts.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `expandedDomains` | Domain names whose Accounts cards are expanded (default all collapsed) |

TS: `app/src/dashboard/accounts-ui-state.ts` → `readUiJson` / `writeUiJson`.

### `api-keys.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `entries[]` | `{ id, domain, label, apiKey, createdAt }` plaintext secrets |

Worker KV stores only key hashes. Plaintext is captured once at create/rotate and kept locally. TS: `app/src/lib/desktop/api-key-vault.ts`.

### `mail/desktop/*.json`

Opaque JSON via `get_mail_json` / `save_mail_json`.

### `cache/**`

Opaque JSON via `get_cache_json` / `save_cache_json`. Includes dashboard envelopes (`dashboard-cache-disk.ts`) and TTL write-through (`dashboard-client-cache.ts` → `dashboard/ttl-*.json`).

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

1. Put it under `~/.relaybase` (usually `mail/desktop/ui/…`, `cache/…`, or extend `email.json` / `api-keys.json` with a Rust schema change).
2. Go through existing Tauri commands — do **not** open ad-hoc files from the Next.js layer (except `/api/local-credentials` for browser next).
3. Do **not** invent a second store in Application Support, Keychain, or `localhost` `localStorage`.
4. Hydrate from disk on boot; migrate legacy `localStorage` keys once if present.
5. TTL API caches may mirror in `localStorage` but must also write through to `~/.relaybase/cache/…` on desktop.
