# `auth` — Authentication, Keyring & Session Module

Rust module managing owner/team credentials, OS keyring persistence, biometric authentication, and worker request forwarding.

## 1. Module Overview & Boundaries

- **Owner Authentication:** Dual refresh tokens (`mail` long TTL, `console` 30m TTL) stored in OS keyring (`owner-session:{workerUrl}`), access tokens kept in process memory only.
- **Owner Passtoken:** Secret token (`rb_pass_...`) stored in a separate OS keyring item (`owner-passtoken:{workerUrl}`), read-gated behind Touch ID / system biometric prompt. Never exposed to JavaScript.
- **Team Authentication:** Teammate mobile password stored in OS keyring (`team-session`). Identity kept in `~/.relaybase/team-login.json`.
- **Keyring Abstraction:** Uses `SecItem` on macOS login keychain (avoiding ACL prompts) and `keyring` crate on Windows/Linux. Debug builds delegate to `dev::keyring_store`.
- **Worker Request Proxy:** Handles authenticated HMAC/bearer requests to the user's deployed Cloudflare Worker (`worker_request_cmd`, `team_worker_request_cmd`).

## 2. File Map

| File | Description |
|------|-------------|
| `mod.rs` | Module root & public re-exports |
| `commands.rs` | Tauri IPC commands (16 commands for owner/team session and worker requests) |
| `owner_session.rs` | Owner session state machine, dual refresh tokens **per Worker URL**, access tokens in memory, proxy requests |
| `owner_passtoken.rs` | Secure storage & biometry-gated reading of the owner passtoken **per Worker URL** |
| `worker_accounts.rs` | Normalized Worker URL → keyring account names + `owner-workers` index |
| `tests/` | Unit tests (`cargo test auth::tests::worker_accounts`) |
| `team_session.rs` | Teammate mobile password lifecycle & proxy requests |
| `keyring_store.rs` | OS keychain/keyring abstraction with in-memory caching |
| `touch_id.rs` | Touch ID (macOS AppKit main thread) & Windows Hello biometry integration |

## 3. Public Rust API (`mod.rs`)

- **Owner Session:** `owner_session_status`, `owner_login`, `owner_boot_mail`, `owner_unlock_console`, `owner_logout`, `owner_login_from_keyring`, `owner_setup_admin`, `owner_reset_admin`, `worker_request`, `current_console_access_token`, `current_access_token`
- **Owner Passtoken:** `store_owner_passtoken`, `load_owner_passtoken_after_auth`, `is_owner_passtoken_stored`, `owner_passtoken_stored_prefix`, `delete_owner_passtoken`
- **Team Session:** `team_session_status`, `team_login`, `team_unlock`, `team_logout`, `team_forget_session`, `team_worker_request`
- **Keyring Store:** `get_password`, `get_password_uncached`, `set_password`, `delete_password`, `forget_cached_password`
- **Biometry:** `touch_id_authenticate`

## 4. Tauri IPC Commands

| IPC Command | Function | TypeScript Bridge File |
|-------------|----------|------------------------|
| `owner_session_status_cmd` | `owner_session_status_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_login_cmd` | `owner_login_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_boot_mail_cmd` | `owner_boot_mail_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_unlock_console_cmd` | `owner_unlock_console_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_logout_cmd` | `owner_logout_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_login_from_keyring_cmd` | `owner_login_from_keyring_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_touch_id_cmd` | `owner_touch_id_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_setup_admin_cmd` | `owner_setup_admin_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `owner_reset_admin_cmd` | `owner_reset_admin_cmd` | `app/src/lib/desktop/bridge/owner.ts` |
| `worker_request_cmd` | `worker_request_cmd` | `app/src/lib/desktop/bridge/worker.ts` |
| `team_session_status_cmd` | `team_session_status_cmd` | `app/src/lib/desktop/bridge/team.ts` |
| `team_login_cmd` | `team_login_cmd` | `app/src/lib/desktop/bridge/team.ts` |
| `team_unlock_cmd` | `team_unlock_cmd` | `app/src/lib/desktop/bridge/team.ts` |
| `team_logout_cmd` | `team_logout_cmd` | `app/src/lib/desktop/bridge/team.ts` |
| `team_forget_session_cmd` | `team_forget_session_cmd` | `app/src/lib/desktop/bridge/team.ts` |
| `team_worker_request_cmd` | `team_worker_request_cmd` | `app/src/lib/desktop/bridge/team.ts` |

## 5. Security & Invariants

1. **Passtoken Isolation:** The plaintext passtoken is **never** sent to JavaScript or written to `~/.relaybase`. It resides strictly in OS keyring `owner-passtoken:{workerUrl}`.
2. **Biometric Gate:** Reading `owner-passtoken:{url}` requires biometry via `touch_id::authenticate` on macOS/Windows before calling `load_owner_passtoken_after_auth`.
3. **Dual Refresh Scopes:** `mail` refresh token has a long TTL for background checks; `console` refresh token has a 30-minute Worker TTL.
4. **Keyring Cache Invalidation:** Passtoken reads bypass the in-process cache (`get_password_uncached`) to guarantee Touch ID verification on every unlock.

## 6. Dependency Rules

- **Allowed Outbound Dependencies:**
  - `crate::storage` (for credentials, team login records, memory session)
  - `crate::cloudflare` (for OAuth recovery account resolution and secrets store check)
  - `crate::dev` (`#[cfg(debug_assertions)]` mock keyring)
- **Forbidden:** Must not import `crate::auto_install` or `crate::shell`.

## 7. Testing

Unit tests live in `tests/` (not inline in production files).

```bash
cargo test auth::tests::worker_accounts --manifest-path desktop/src-tauri/Cargo.toml
```
