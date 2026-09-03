# `storage` — Local Persistence & `~/.relaybase` Data Store Module

Rust module managing local disk storage under `~/.relaybase`, account scoping (layout v2), local mail/cache file I/O, API key vaults, email UI preferences, and factory reset cleanup.

## 1. Module Overview & Boundaries

- **Account Scoping (Layout v2):** Tenant-owned data (mail, cache, preferences, API keys) is isolated under `~/.relaybase/{scopeId}/`, where `scopeId` is an opaque SHA-256 prefix `s-{16hex}` derived from account and worker URL (`layout.rs`).
- **Workspace Credentials:** `workspace.json` holds non-sensitive endpoint configurations (`accountId`, `workerUrl`, `workerScriptName`, `relaybaseAccountId`, etc.) (`credentials.rs`).
- **In-Memory OAuth State:** Transient Cloudflare OAuth access tokens and metadata live only in process RAM (`memory_session.rs`).
- **Mail & Cache Store:** Atomic JSON and binary file I/O with path validation to prevent directory traversal (`mail_store.rs`).
- **API Key Vault:** User API keys stored encrypted/permission-restricted on disk (`vault.rs`).
- **Factory Reset & WebKit Cleanup:** Completely clears `~/.relaybase` as well as macOS WKWebView WebsiteData / caches (`webkit.rs`).

## 2. File Map

| File | Description |
|------|-------------|
| `mod.rs` | Module root & public re-exports |
| `layout.rs` | Storage layout v2 scoping (`s-{hash}`), migrations, home dir resolution |
| `credentials.rs` | `workspace.json` credentials, `team-login.json` identity, global wipe |
| `memory_session.rs` | Process-memory CF OAuth session holder (`CF_OAUTH_SESSION`) |
| `mail_store.rs` | Local mail atom JSON, binary attachments, and cache JSON read/write |
| `prefs.rs` | Email UI preferences (`email.json`) |
| `vault.rs` | API key vault (`api-keys.json`) management |
| `webkit.rs` | WKWebView WebsiteData, LocalStorage, and cookie cleanup |
| `commands.rs` | Tauri IPC commands (26 commands for storage, mail files, and reset) |

## 3. Public Rust API (`mod.rs`)

- **Credentials & Workspace:** `load_credentials`, `load_credentials_merged`, `save_credentials`, `clear_credentials`, `clear_all_relaybase_data`, `load_team_login`, `save_team_login`, `clear_team_login`
- **Scoping & Layout:** `resolve_account_scope_id`, `current_scope_id`, `migrate_storage_layout_v2`, `migrate_mail_to_desktop_user`, `relaybase_dir`, `scoped_dir`, `workspace_path`, `ensure_dir`
- **Mail Store:** `save_mail_json`, `load_mail_json`, `save_mail_binary`, `load_mail_binary`, `delete_mail_binary`, `delete_mail_binary_dir`, `save_cache_json`, `load_cache_json`
- **In-Memory Session:** `get_cf_oauth_session`, `set_cf_oauth_session`, `clear_cf_oauth_session`, `apply_cf_oauth_session`
- **UI Prefs & Vault:** `load_email_prefs`, `save_email_prefs`, `load_api_key_vault`, `save_api_key_vault`, `upsert_api_key_vault_entry`, `remove_api_key_vault_entry`
- **WebKit:** `clear_webkit_data`

## 4. Tauri IPC Commands

| IPC Command | Function | TypeScript Bridge File |
|-------------|----------|------------------------|
| `save_cf_credentials` | `save_cf_credentials` | `app/src/lib/desktop/bridge/credentials.ts` |
| `get_credentials` | `get_credentials` | `app/src/lib/desktop/bridge/credentials.ts` |
| `clear_stored_credentials` | `clear_stored_credentials` | `app/src/lib/desktop/bridge/credentials.ts` |
| `clear_webkit_data_cmd` | `clear_webkit_data_cmd` | `app/src/lib/desktop/bridge/credentials.ts` |
| `factory_reset_cmd` | `factory_reset_cmd` | `app/src/lib/desktop/bridge/credentials.ts` |
| `get_email_prefs` | `get_email_prefs` | `app/src/lib/desktop/bridge/email-prefs.ts` |
| `save_email_prefs` | `save_email_prefs` | `app/src/lib/desktop/bridge/email-prefs.ts` |
| `get_api_key_vault` | `get_api_key_vault` | `app/src/lib/desktop/bridge/vault.ts` |
| `save_api_key_vault_entry` | `save_api_key_vault_entry` | `app/src/lib/desktop/bridge/vault.ts` |
| `remove_api_key_vault_entry_cmd` | `remove_api_key_vault_entry_cmd` | `app/src/lib/desktop/bridge/vault.ts` |
| `migrate_mail_user_folder` | `migrate_mail_user_folder` | `app/src/lib/desktop/bridge/storage.ts` |
| `get_account_scope_id` | `get_account_scope_id` | `app/src/lib/desktop/bridge/storage.ts` |
| `migrate_storage_layout` | `migrate_storage_layout` | `app/src/lib/desktop/bridge/storage.ts` |
| `get_mail_json` | `get_mail_json` | `app/src/lib/desktop/bridge/storage.ts` |
| `save_mail_json` | `save_mail_json` | `app/src/lib/desktop/bridge/storage.ts` |
| `get_mail_binary` | `get_mail_binary` | `app/src/lib/desktop/bridge/storage.ts` |
| `save_mail_binary` | `save_mail_binary` | `app/src/lib/desktop/bridge/storage.ts` |
| `delete_mail_binary` | `delete_mail_binary` | `app/src/lib/desktop/bridge/storage.ts` |
| `delete_mail_binary_dir` | `delete_mail_binary_dir` | `app/src/lib/desktop/bridge/storage.ts` |
| `get_cache_json` | `get_cache_json` | `app/src/lib/desktop/bridge/storage.ts` |
| `save_cache_json` | `save_cache_json` | `app/src/lib/desktop/bridge/storage.ts` |
| `save_relaybase_account` | `save_relaybase_account` | `app/src/lib/desktop/bridge/credentials.ts` |
| `clear_relaybase_account` | `clear_relaybase_account` | `app/src/lib/desktop/bridge/credentials.ts` |
| `get_team_login` | `get_team_login` | `app/src/lib/desktop/bridge/team.ts` |
| `save_team_login_cmd` | `save_team_login_cmd` | `app/src/lib/desktop/bridge/team.ts` |
| `clear_team_login_cmd` | `clear_team_login_cmd` | `app/src/lib/desktop/bridge/team.ts` |

## 5. Security & Invariants

1. **No Tokens On Disk:** Secret tokens (access tokens, refresh tokens, passtokens, mobile passwords) must **never** be saved in `workspace.json` or `team-login.json`.
2. **Path Sanitization:** `mail_file_path` and `cache_file_path` strictly reject paths containing `..`, absolute paths, empty segments, or non-whitelisted characters.
3. **Restricted Permissions:** All created files and directories under `~/.relaybase` are chmodded to `0o600` / `0o700` on Unix systems.
4. **Atomic Writes:** JSON updates use temporary files (`.tmp`) and atomic rename to prevent corruption on sudden termination.

## 6. Dependency Rules

- **Allowed Outbound Dependencies:**
  - `crate::auth` (for `owner_logout`, `team_logout`)
  - `crate::cloudflare` (for `load_keyring_oauth_refresh`, `delete_keyring_oauth_refresh`)
  - `crate::dev` (`#[cfg(debug_assertions)]` dev OAuth cache)
- **Forbidden:** Must not import `crate::auto_install` or `crate::shell`.

## 7. Testing

Run unit tests for storage:
```bash
cargo test storage --manifest-path desktop/src-tauri/Cargo.toml
```
