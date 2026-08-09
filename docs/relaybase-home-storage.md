# Desktop storage — `~/.relaybase`

**Audience:** humans and coding agents changing desktop persistence, credentials, mail cache, sidebar UI state, or notifications.

**Source of truth (desktop):** `$HOME/.relaybase` only.  
Implemented in `desktop/src-tauri/src/secrets.rs`, `desktop/src-tauri/src/notify.rs`, and the TS facades under `app/src/email/*-disk*` / `email-prefs.ts`.

---

## Rule (non-negotiable)

On the **Mac / Tauri desktop app**, durable user data **must** live under `~/.relaybase`.

| Allowed | Forbidden as durable store |
|---------|----------------------------|
| `~/.relaybase/**` via Tauri commands (`get_/save_credentials`, `get_/save_email_prefs`, `get_/save_mail_json`) | WebKit / Application Support (`~/Library/WebKit/*`, `~/Library/Application Support/Relaybase*`) |
| | `localStorage` / `sessionStorage` for the `http://127.0.0.1:*` or `http://localhost:*` origin |
| | Ad-hoc paths under the repo (`data/`, `app/data/`, etc.) for desktop UX |
| | Keychain / other home dirs as a second source of truth (unless explicitly migrated later) |

`localStorage` may mirror disk for sync reads **after** hydrate. It is **not** the source of truth. Binary renames (`relaybase_desktop` → `Relaybase`) reset WebKit profiles and will look like “data wiped” if anything still depends on localhost storage alone.

Server/worker data (Cloudflare KV, R2, D1) is separate — that is the remote product store, not local desktop UX state.

---

## Directory layout

```text
~/.relaybase/                      # mode 0700
├── credentials.json               # Cloudflare + Worker + license (0600)
├── email.json                     # account colors / email prefs (0600)
├── app-icon.png                   # notification identity image (seeded from bundle)
└── mail/
    └── {userId}/                  # e.g. isaac
        ├── inbox.json
        ├── sent.json
        ├── drafts.json
        ├── details/
        │   └── {messageKey}.json
        └── ui/
            ├── enabled-accounts.json
            ├── sidebar.json
            ├── read.json
            └── trash.json
```

`{userId}` is the session id (`relaybase_user` cookie), sanitized to `[A-Za-z0-9._%-]`.

Legacy / unrelated files that may still exist locally (`tenants.json`, `logs.json`, `aws-settings.json`, `email-ui/`) are **not** part of the current desktop contract — do not extend them; prefer the layout above.

---

## File contracts

### `credentials.json`

Written only by Rust (`secrets.rs`). Shape (camelCase):

| Field | Purpose |
|-------|---------|
| `accountId` | Cloudflare account |
| `apiToken` | Cloudflare API token |
| `workerUrl` | Deployed Worker base URL |
| `adminToken` | Worker admin token |
| `workerScriptName` | Wrangler script name |
| `licenseKey` | License |

### `email.json`

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `accountColors` | `{ [email]: "#RRGGBB" }` |

TS: `app/src/email/email-prefs.ts` → `get_email_prefs` / `save_email_prefs`.

### `mail/{userId}/*.json`

Opaque JSON via `get_mail_json` / `save_mail_json`. Relative paths must not contain `..` or unsafe segments (enforced in Rust).

| Relative path | Shape (approx.) |
|---------------|-----------------|
| `{userId}/inbox.json` | `{ messages: RoutingActivityEvent[] }` |
| `{userId}/sent.json` | `{ sent: SentEmail[] }` |
| `{userId}/drafts.json` | `{ drafts: DraftEmail[] }` |
| `{userId}/details/{key}.json` | full message detail |
| `{userId}/ui/enabled-accounts.json` | `{ emails: string[] }` |
| `{userId}/ui/sidebar.json` | `{ mode, lastEmailPath, lastDashboardPath, collapsed }` |
| `{userId}/ui/read.json` | `{ keys: string[] }` — missing file = first-run baseline |
| `{userId}/ui/trash.json` | `{ entries: TrashEntry[] }` |

TS facades:

- Lists/details → `app/src/email/email-disk-store.ts`
- UI JSON → `app/src/email/user-ui-disk.ts` (+ `enabled-accounts.ts`, `sidebar-mode.ts`, `read-store.ts`, `trash-store.ts`)

### `app-icon.png`

Seeded on app launch from the bundled Tauri icon. Used by `show_notification` so macOS banners are not stuck on Terminal / stale WebKit icons.

---

## Read / write flow (desktop)

```text
UI / store
  → write*: dual-write local mirror (optional) + required desktopSave*
  → hydrate*: desktopGet* first; if disk empty and legacy localStorage has data, migrate up once
```

1. **Write (desktop):** must succeed on `~/.relaybase`. Failure must surface — do not pretend success after only writing `localStorage`.
2. **Read (desktop):** prefer disk. Use `localStorage` only as a warm cache or one-time migration source.
3. **Browser-only / non-Tauri:** `localStorage` fallback is allowed (no home-dir bridge). That path is not the Mac product.

Related: [last-route-restore.md](./last-route-restore.md) (sidebar paths live in `ui/sidebar.json`).

---

## Agent checklist

When adding durable desktop state:

1. Put it under `~/.relaybase` (usually `mail/{userId}/ui/…` or extend `email.json` with a Rust schema change).
2. Go through existing Tauri commands — do **not** open ad-hoc files from the Next.js layer.
3. Do **not** invent a second store in Application Support, Keychain, or `localhost` `localStorage`.
4. Hydrate from disk on boot; migrate legacy `localStorage` keys once if present.
5. Keep `products-v1:*` API TTL caches in `localStorage` if needed — they are refetchable, not UX source of truth.

---

## Why this exists

Tauri `dev` runs a bare binary. WebKit data directories follow the **process name** (`relaybase_desktop` vs `Relaybase`). Relying on that profile for accounts / sidebar / read state caused empty UIs after renames even though `~/.relaybase/mail` was intact. Home-dir storage survives renames, rebuilds, and origin changes (`127.0.0.1` vs `localhost`).
