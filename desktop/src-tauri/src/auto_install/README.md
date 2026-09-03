# Auto Install Module (`desktop/src-tauri/src/auto_install`)

## 1. Module Overview & Boundaries
The `auto_install` module provides background orchestration for automated provisioning, upgrading, database initialization/migration, and rollback of the Relaybase routing Worker in a user's Cloudflare account. It coordinates Cloudflare REST APIs (Workers, R2, D1) with pre-built distribution artifacts fetched from `relaybase.xyz/downloads`.

- **Primary Responsibility**: Automated Worker deploy/update, D1 database provisioning, R2 bucket setup, secret injection (`AUTH_PEPPER`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`), and install progress streaming.
- **Boundaries**:
  - Uses `cloudflare::oauth::require_cf_oauth()` for Cloudflare authentication.
  - Updates local credentials via `storage::save_credentials()`.
  - Emits real-time progress events (`install-log`) directly to the Tauri frontend.

---

## 2. File Map

| File | Purpose |
|---|---|
| `mod.rs` | Module root & public API re-exports |
| `README.md` | AI agent documentation and architectural guide |
| `commands.rs` | Tauri IPC command handlers for auto install, update checks, DB migration, and rollback |
| `install.rs` | Main installation orchestrator (`auto_install_worker`, `update_installed_worker`) |
| `probe.rs` | Resource probe to inspect existing Worker, R2 buckets, and D1 databases |
| `rollback.rs` | Rollback orchestrator to delete provisioned Cloudflare resources on failure or user request |
| `manifest.rs` | Install manifest fetcher, version comparator, and ZIP download/staging |
| `schema.rs` | Worker database schema initialization (`init-db`) and migration (`migrate-db`) |
| `health.rs` | Worker warmup poller (`GET /health`) and auth status inspection (`GET /console/auth-status`) |
| `wipe.rs` | Safe wipe phrase validation (`DELETE ME`) and decision plan parser |
| `url.rs` | Worker URL parsing, hostname extraction, and workers.dev domain matching |
| `credentials.rs` | Post-install credential merging and Worker secret injection |
| `cancel.rs` | Thread-safe install cancellation signal flag |
| `log.rs` | Tauri event emitter for streaming install log lines |
| `errors.rs` | Cloudflare API error payload parser and diagnostic message formatter |
| `types.rs` | Serde data structures (manifest, probe, results, decisions, logs) |
| `constants.rs` | Resource naming constants, download URLs, and polling timeouts |

---

## 3. Public Rust API (`mod.rs`)

```rust
// Orchestrators & Probes
pub async fn probe_install_resources(access_token: String, account_id: Option<String>) -> Result<InstallProbeResult, String>;
pub async fn auto_install_worker(app: tauri::AppHandle, access_token: String, account_id: Option<String>, server_token: Option<String>, decisions: Vec<InstallDecision>, wipe_confirmation: Option<String>) -> Result<AutoInstallResult, String>;
pub async fn update_installed_worker(app: tauri::AppHandle, access_token: String, account_id: Option<String>, server_token: Option<String>) -> Result<AutoInstallResult, String>;
pub async fn rollback_all_install(app: tauri::AppHandle, access_token: String, account_id: Option<String>, wipe_confirmation: Option<String>) -> Result<(), String>;
pub fn request_install_cancel();

// Manifest & Updates
pub async fn check_worker_update(current_version: Option<String>, desktop_version: String) -> Result<WorkerUpdateCheck, String>;
pub async fn fetch_install_manifest() -> Result<WorkerInstallManifest, String>;
pub async fn preview_worker_update_target(access_token: &str, account_id: &str, current_worker_url: &str, worker_script_name: &str) -> Result<WorkerUpdateTarget, String>;

// DB Schema
pub async fn init_worker_db(worker_url: &str, worker_token: Option<&str>, console_access_token: Option<&str>, cf_access_token: Option<&str>) -> Result<InitDbResult, String>;
pub async fn migrate_worker_db(worker_url: &str, worker_token: Option<&str>, console_access_token: Option<&str>, cf_access_token: Option<&str>) -> Result<InitDbResult, String>;

// Helpers & Secrets
pub fn merge_into_credentials(existing: &crate::storage::StoredCredentials, result: &AutoInstallResult, account_id: Option<String>) -> crate::storage::StoredCredentials;
pub async fn push_cf_api_token_secret(account_id: &str, script_name: &str, access_token: &str, server_token: &str) -> Result<String, String>;
```

---

## 4. Tauri IPC Commands

| Tauri Command (`commands.rs`) | Frontend Invocation (`app/src/lib/desktop/bridge/*`) | Description |
|---|---|---|
| `probe_auto_install` | `desktop/bridge/index.ts` -> `probeAutoInstall()` | Probes account for existing Worker, R2, D1 resources |
| `auto_install_routing_worker` | `desktop/bridge/index.ts` -> `autoInstallRoutingWorker()` | Executes full automated install flow |
| `check_worker_update_cmd` | `desktop/bridge/index.ts` -> `checkWorkerUpdate()` | Checks if a newer Worker version is available |
| `preview_worker_update_target_cmd` | `desktop/bridge/index.ts` -> `previewWorkerUpdateTarget()` | Inspects workers.dev URL before applying update |
| `update_installed_worker_cmd` | `desktop/bridge/index.ts` -> `updateInstalledWorker()` | Downloads latest bundle and deploys over existing Worker |
| `cancel_auto_install` | `desktop/bridge/index.ts` -> `cancelAutoInstall()` | Requests cooperative cancellation of in-flight install |
| `rollback_auto_install` | `desktop/bridge/index.ts` -> `rollbackAutoInstall()` | Deletes provisioned Cloudflare resources |
| `init_worker_db_cmd` | `desktop/bridge/index.ts` -> `initWorkerDb()` | Initializes schema on newly created empty D1 databases |
| `migrate_worker_db_cmd` | `desktop/bridge/index.ts` -> `migrateWorkerDb()` | Applies non-destructive schema migrations to existing D1 databases |
| `push_server_token` | `desktop/bridge/index.ts` -> `pushServerToken()` | Pushes CF API token as Worker secret `CF_API_TOKEN` |

---

## 5. Security & Invariants

1. **OAuth Token In-Memory Only**:
   - `access_token` is retrieved from `cloudflare::oauth::require_cf_oauth()` and passed in memory; it is never written to disk.
2. **Safe Deletion Guards**:
   - Occupied D1 or R2 resources cannot be overwritten or deleted without explicit `wipe_confirmation == "DELETE ME"`.
3. **Rollback Verification**:
   - `rollback_all_install` verifies complete resource removal from Cloudflare before returning success.
4. **Pepper Protection**:
   - `AUTH_PEPPER` is injected on initial install and preserved during Worker-only updates or D1 reuse.

---

## 6. Dependency Rules

- **Allowed Inbound**: `lib.rs` (Tauri command registration).
- **Allowed Outbound**:
  - `auth` (`owner_session::current_console_access_token`)
  - `cloudflare` (`oauth::{require_cf_oauth, cf_oauth_if_present}`)
  - `storage` (`credentials::{load_credentials, save_credentials, StoredCredentials}`)
- **Internal Layering**:
  - `cancel`, `log`, `constants`, `types`, `errors` (Leaf)
  - `url`, `wipe`, `manifest`, `health`, `schema`, `credentials`, `probe`, `rollback` (Mid)
  - `install` (Orchestrator)
  - `commands.rs` / `mod.rs` (Public Interface)

---

## 7. Testing

Run unit tests for the auto-install module:
```bash
cargo test --manifest-path desktop/src-tauri/Cargo.toml auto_install
```
