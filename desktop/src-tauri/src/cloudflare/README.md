# `cloudflare` — Cloudflare API, OAuth PKCE & Worker Integration Module

Rust module for communicating with the Cloudflare REST API, managing the PKCE OAuth lifecycle, running the local callback loopback server, and probing/verifying user-deployed Workers.

## 1. Module Overview & Boundaries

- **Cloudflare REST Client:** Low-level HTTP requests for D1 databases, R2 buckets, Workers scripts, secrets, and cron triggers (`client.rs`).
- **OAuth PKCE Lifecycle:** Start authorization, exchange authorization code, silent token refresh with sliding 30-day refresh token stored in OS keyring (`oauth.rs`).
- **OAuth Loopback Server:** Local TCP HTTP server listening on `127.0.0.1:32831` to receive OAuth callbacks in development and production (`loopback.rs`).
- **Worker Management:** High-level probe, adopt, install, and update helpers (`worker.rs`).
- **Connection Verification:** Verify user-deployed Workers via `GET /console/connect` and D1/R2 probes (`commands.rs`).

## 2. File Map

| File | Description |
|------|-------------|
| `mod.rs` | Module root & public re-exports |
| `client.rs` | Cloudflare REST API client (D1, R2, Workers, Account resolution, Tokens) |
| `oauth.rs` | In-memory OAuth session reader (`require_cf_oauth`), token refresh, keyring persistence |
| `loopback.rs` | PKCE verifier/challenge, OAuth start/complete flow, loopback TCP listener on port 32831 |
| `worker.rs` | Worker probe, adopt, manual install, and update routines |
| `commands.rs` | Tauri IPC commands (10 commands for token verify, OAuth, Worker connect, install) |

## 3. Public Rust API (`mod.rs`)

- **REST Client:** `verify_token`, `list_zones`, `find_zone`, `assert_r2_subscription`, `ensure_r2_bucket`, `find_r2_bucket`, `delete_r2_bucket`, `empty_r2_bucket`, `probe_r2_occupancy`, `ensure_d1_database`, `find_d1_database`, `delete_d1_database`, `list_d1_databases`, `count_d1_user_rows`, `upload_worker_script`, `put_worker_secret`, `set_worker_cron`, `enable_workers_dev`, `disable_workers_dev`, `delete_worker_script`, `worker_script_exists`, `worker_health_ok`, `resolve_account_id`, `resolve_account_id_for_recover`, `resolve_account_id_for_recover_with_hint`, `secrets_store_accessible`
- **OAuth:** `require_cf_oauth`, `require_cf_oauth_access_token`, `cf_oauth_if_present`, `save_keyring_oauth_refresh`, `load_keyring_oauth_refresh`, `delete_keyring_oauth_refresh`, `new_iso_expires`
- **Loopback & URL:** `console_base_url`, `run_oauth_loopback_server`, `parse_oauth_callback_url`, `emit_oauth_result`
- **Worker Management:** `probe_install`, `adopt_worker`, `install_worker`, `update_worker`

## 4. Tauri IPC Commands

| IPC Command | Function | TypeScript Bridge File |
|-------------|----------|------------------------|
| `verify_cf_token` | `verify_cf_token` | `app/src/lib/desktop/bridge/worker.ts` |
| `probe_routing_worker` | `probe_routing_worker` | `app/src/lib/desktop/bridge/install.ts` |
| `adopt_routing_worker` | `adopt_routing_worker` | `app/src/lib/desktop/bridge/install.ts` |
| `install_routing_worker` | `install_routing_worker` | `app/src/lib/desktop/bridge/install.ts` |
| `update_routing_worker` | `update_routing_worker` | `app/src/lib/desktop/bridge/install.ts` |
| `start_cf_oauth` | `start_cf_oauth` | `app/src/lib/desktop/bridge/oauth.ts` |
| `complete_cf_oauth` | `complete_cf_oauth` | `app/src/lib/desktop/bridge/oauth.ts` |
| `refresh_install_token` | `refresh_install_token` | `app/src/lib/desktop/bridge/oauth.ts` |
| `verify_worker_connection` | `verify_worker_connection` | `app/src/lib/desktop/bridge/worker.ts` |
| `save_worker_connection` | `save_worker_connection` | `app/src/lib/desktop/bridge/worker.ts` |

## 5. Security & Invariants

1. **Access Token Lifespan:** `access_token` is held in process memory only. It is never written to disk or `workspace.json`.
2. **Refresh Token Storage:** `refresh_token` is stored exclusively in OS keyring `cf-oauth-install` (or debug cache in `tauri dev`).
3. **Loopback Server Scope:** `127.0.0.1:32831` accepts only `/oauth/callback` requests and verifies state against the in-flight PKCE session.
4. **Silent Refresh Window:** Token refresh is triggered automatically when the access token has less than 60 seconds of validity remaining.

## 6. Dependency Rules

- **Allowed Outbound Dependencies:**
  - `crate::auth` (for `keyring_store` and `current_console_access_token`)
  - `crate::storage` (for `StoredCredentials` and `CfOAuthSession`)
  - `crate::dev` (`#[cfg(debug_assertions)]` dev caches)
- **Forbidden:** Must not import `crate::auto_install` or `crate::shell`.

## 7. Testing

Run unit tests for Cloudflare OAuth and keyring lifecycle:
```bash
cargo test cloudflare --manifest-path desktop/src-tauri/Cargo.toml
```
