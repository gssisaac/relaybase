# auto_install — Desktop Worker install module

Rust module for background auto-install of the Relaybase routing Worker into the user's Cloudflare account. Uses a pre-built install ZIP from `relaybase.xyz/downloads` and the Cloudflare HTTP API. Auth is `require_cf_oauth()` (in-memory CF OAuth session). The access token is not sent to the Relaybase console. Schema calls may send it to the product Worker as `X-Cf-Access-Token`.

## Install flow

Each step streams `install-log` Tauri events to the frontend (`step`, `level`, `line`).

0. **Probe** — `probe_install_resources` lists Worker / R2 / D1 and occupancy.
1. **Manifest / ZIP** — Fetch `worker-install-manifest.json`, download versioned ZIP, verify SHA-256, stage `wrangler.toml` + `worker.js`.
2. **R2** — Ensure bucket `relaybase-mailbox` (or reuse on Worker-only update).
3. **D1** — Create or reuse `relaybase-logs`, `relaybase-mail`, `relaybase-db` (schema applied later).
4. **Deploy** — Upload `worker.js` with bindings, set cron, enable workers.dev.
5. **Secrets** — PUT `AUTH_PEPPER` (skipped when reusing D1 or Worker-only update), `CF_ACCOUNT_ID`, optional `CF_API_TOKEN`.
6. **Warmup** — Poll `GET /health` (~30s backoff).
7. **Schema** — Probe `GET /console/auth-status`. Empty D1s: `POST /console/init-db`. Reused D1: `POST /console/migrate-db`. Auth is console session, Cloudflare OAuth (`X-Cf-Access-Token` that can GET `/accounts/{CF_ACCOUNT_ID}`), or pepper bootstrap when no owner exists. OAuth upgrade must not fail when an owner already exists.

## Recovering a stuck install (`ownerConfigured: true`)

Cloudflare OAuth install / upgrade may call migrate-db with `X-Cf-Access-Token` (GET `/accounts/{CF_ACCOUNT_ID}`). An existing owner must not fail that path.

If you lost the passtoken and need to sign in:

1. **Do not** Rollback from Setup (that deletes D1 / R2).
2. **Setup → I forgot my passtoken** (`/setup/recover-admin`) — Cloudflare OAuth (Secrets Store Write client) re-issues a passtoken for the current Worker.
3. Sign in via **Already installed** (`/setup/connect`).

Rollback (`rollback_all_install`) deletes Worker, D1s, and R2 by name; occupied resources require wipe confirmation. Returns an error if any resource is still present after delete attempts (the UI does not show “Rolled back” on failure).

## File map

| File | Role |
|------|------|
| `mod.rs` | Module root; `pub use` re-exports for `lib.rs` |
| `constants.rs` | `R2_BUCKET`, `D1_DATABASES`, manifest URL, wipe phrase, warmup backoff |
| `types.rs` | Serde types: manifest, probe, result, `InitDbResult`, internal `LogEvent` / `InstallRunOptions` |
| `cancel.rs` | Install cancel flag + `request_install_cancel` |
| `log.rs` | `emit_log` → Tauri `install-log` event |
| `errors.rs` | CF Worker HTTP error parsing and init-db failure hints |
| `url.rs` | Worker URL host match; update-target preview vs OAuth account |
| `wipe.rs` | `DELETE ME` / resource-name confirmation; `InstallPlan` from UI decisions |
| `manifest.rs` | Manifest fetch, update check, ZIP download/stage, staged version |
| `health.rs` | `/health` warmup, `/console/auth-status`, version fetch, post-deploy shape logging |
| `probe.rs` | `probe_install_resources` |
| `rollback.rs` | `rollback_all_install` |
| `schema.rs` | `init_worker_db`, `migrate_worker_db` (+ retry) |
| `credentials.rs` | `merge_into_credentials`, `push_cf_api_token_secret`, `now_iso` |
| `install.rs` | `auto_install_worker`, `update_installed_worker`, orchestrator |

## Public API (`mod.rs` re-exports)

Functions and types consumed by `lib.rs` Tauri commands:

- **Install:** `auto_install_worker`, `update_installed_worker`, `probe_install_resources`, `rollback_all_install`, `request_install_cancel`
- **Updates:** `check_worker_update`, `fetch_install_manifest`, `preview_worker_update_target`, `assert_worker_update_target_matches`, `worker_urls_match`, `worker_url_host`
- **Schema:** `init_worker_db`, `migrate_worker_db`
- **Post-install:** `merge_into_credentials`, `push_cf_api_token_secret`, `now_iso`
- **Wipe:** `wipe_confirmation_allows`, `WIPE_PHRASE_DELETE_ME`
- **Types:** `AutoInstallResult`, `InitDbResult`, `InstallDecision`, `InstallProbeResult`, `InstallResourceProbe`, `WorkerInstallManifest`, `WorkerUpdateCheck`, `WorkerUpdateTarget`
- **Constants:** `INSTALL_CANCELLED`, `WORKER_URL_ACCOUNT_MISMATCH`

## Dependency rules

- Leaf modules (`cancel`, `log`, `constants`, `types`, `errors`) have no `install` dependency.
- Mid modules (`url`, `wipe`, `manifest`, `health`, `schema`, `probe`, `rollback`, `credentials`) must not import `install.rs`.
- `install.rs` is the orchestrator; it calls all phase helpers.
- External crate boundaries: `cloudflare`, `secrets`, `worker`, `owner_session`, `cf_oauth` (crate root modules). Commands obtain `{ access_token, account_id }` from `require_cf_oauth()` before calling this module.

```
cancel, log, constants, types, errors
         ↓
url, wipe, manifest, health, schema, credentials, probe, rollback
         ↓
install (orchestrator)
         ↓
mod.rs (re-exports) → lib.rs Tauri commands
```

## `install.rs` phase functions

`auto_install_steps` delegates to private phase functions (same file):

| Function | Responsibility |
|----------|----------------|
| `prepare_r2` | Worker-only URL guard; R2 subscription; reinstall or ensure bucket |
| `prepare_d1` | D1 lookup / create / reuse → `(d1_ids, any_d1_reused)` |
| `deploy_worker` | Upload script, verify bindings, cron, workers.dev URL |
| `apply_secrets` | `AUTH_PEPPER` (skip when D1 reused or worker-only), optional `CF_ACCOUNT_ID`, optional `CF_API_TOKEN` |
| `finalize_schema` | auth-status gate; init-db or migrate-db with console session or Cloudflare OAuth |

## Tauri command mapping (`lib.rs`)

| Command | auto_install entry |
|---------|-------------------|
| `probe_auto_install` | `probe_install_resources` |
| `auto_install_routing_worker` | `auto_install_worker` + `merge_into_credentials` |
| `check_worker_update_cmd` | `check_worker_update` |
| `preview_worker_update_target_cmd` | `preview_worker_update_target` |
| `update_installed_worker_cmd` | `update_installed_worker` + `merge_into_credentials` |
| `cancel_auto_install` | `request_install_cancel` |
| `rollback_auto_install` | `rollback_all_install` |
| `init_worker_db_cmd` | `init_worker_db` |
| `migrate_worker_db_cmd` | `migrate_worker_db` |
| Settings CF API token push | `push_cf_api_token_secret` |

## Tests

| Module | Test module |
|--------|-------------|
| `wipe.rs` | `wipe_phrase_tests` |
| `url.rs` | `worker_url_match_tests` |
| `manifest.rs` | `worker_js_tests` |
| `errors.rs` | `worker_error_tests` |

Run: `cargo test auto_install` from `desktop/src-tauri`.
