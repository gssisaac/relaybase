# Dev / Debug Testing Module (`desktop/src-tauri/src/dev`)

## 1. Module Overview & Boundaries
The `dev` module contains development-only persistence helpers and test fixtures compiled strictly under debug mode (`#[cfg(debug_assertions)]`). It is omitted from production release builds.

- **Primary Responsibility**: Temporary file-based OAuth session cache (`~/.relaybase/tmp/cf-oauth-dev.json`) and mock keyring store for headless local development (`tauri dev`).
- **Boundaries**:
  - Gated behind `#[cfg(debug_assertions)]`.
  - Stored under `~/.relaybase/tmp/` (or directory pointed by `RELAYBASE_DEV_TMP_DIR`).
  - Production builds MUST NEVER depend on or include this module.

---

## 2. File Map

| File | Purpose |
|---|---|
| `mod.rs` | Module root & debug-only re-exports |
| `README.md` | AI agent documentation and architectural guide |
| `cf_oauth_cache.rs` | Local filesystem cache for Cloudflare OAuth tokens to preserve login state across `tauri dev` reloads |
| `keyring_store.rs` | Local filesystem mock for keyring secret storage during headless test environments |
| `tmp_fs.rs` | File system helpers for temporary directories, safe filename sanitization, and permission setting |

---

## 3. Public Rust API (`mod.rs`)

```rust
// CF OAuth Dev Cache
pub fn save_cf_oauth_cache(session: &crate::storage::CfOAuthSession);
pub fn load_cf_oauth_cache() -> Option<crate::storage::CfOAuthSession>;
pub fn clear_cf_oauth_cache();
pub fn hydrate(session_slot: &std::sync::Mutex<Option<crate::storage::CfOAuthSession>>);

// Dev Keyring Store Mock
pub fn get_password(service: &str, account: &str) -> Result<Option<String>, String>;
pub fn set_password(service: &str, account: &str, password: &str) -> Result<(), String>;
pub fn delete_password(service: &str, account: &str);
```

---

## 4. Security & Invariants

1. **Debug-Assertions Gate**:
   - Every file in this module and its registration in `lib.rs` MUST be enclosed within `#[cfg(debug_assertions)]`.
2. **Strict File Permissions**:
   - Temporary dev stores are created with `0o700` (directories) and `0o600` (files) on Unix platforms.
3. **Explicit Warning Headers**:
   - JSON files written by this module contain `"warning": "DEV-MODE TESTING ONLY — ..."` headers.

---

## 5. Dependency Rules

- **Allowed Inbound**: `lib.rs`, `storage/memory_session.rs`, `auth/keyring_store.rs` (under `debug_assertions`).
- **Allowed Outbound**:
  - `storage` (`CfOAuthSession`)
  - `cloudflare::oauth` (`save_keyring_oauth_refresh`)
