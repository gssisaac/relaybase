//! Background auto-install of the Relaybase routing Worker into the user's
//! Cloudflare account using a pre-built install ZIP + the Cloudflare HTTP API.
//!
//! Flow (each step streams `install-log` events to the frontend):
//!   0. `probe_install_resources` lists Worker / R2 / D1 that already exist.
//!   1. Fetch worker-install-manifest.json and download the versioned ZIP.
//!   2. Ensure R2 bucket `relaybase-mailbox`.
//!   3. Create D1 databases (schema via POST /console/init-db after deploy).
//!   4. Generate an admin token; PUT Worker secrets.
//!   5. PUT `worker.js` with bindings; enable workers.dev.
//!   6. POST /console/init-db; read version from GET /console/connect.
//!
//! Auth is the in-memory CF OAuth access token (or a legacy disk install
//! token). It is never sent to the Relaybase console or product Worker.

use std::env;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use sha2::{Digest, Sha256};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::Notify;

use crate::cloudflare::{
    assert_r2_subscription, create_d1_database, delete_d1_database, delete_r2_bucket,
    delete_worker_script, empty_r2_bucket, enable_workers_dev, ensure_r2_bucket, find_r2_bucket,
    list_d1_databases, list_worker_bindings, put_worker_schedules, put_worker_secret,
    resolve_account_id, upload_worker_script, worker_script_exists, CfClient,
    DEFAULT_WORKER_CRON,
};
use crate::secrets::StoredCredentials;
use crate::worker::DEFAULT_SCRIPT;

/// Returned to the UI when the user stops install. Keep this token stable.
pub const INSTALL_CANCELLED: &str = "INSTALL_CANCELLED";

static INSTALL_CANCEL_FLAG: AtomicBool = AtomicBool::new(false);
static INSTALL_CANCEL_NOTIFY: OnceLock<Notify> = OnceLock::new();

fn cancel_notify() -> &'static Notify {
    INSTALL_CANCEL_NOTIFY.get_or_init(Notify::new)
}

pub fn request_install_cancel() {
    INSTALL_CANCEL_FLAG.store(true, Ordering::SeqCst);
    cancel_notify().notify_waiters();
}

fn reset_install_cancel() {
    INSTALL_CANCEL_FLAG.store(false, Ordering::SeqCst);
}

fn install_is_cancelled() -> bool {
    INSTALL_CANCEL_FLAG.load(Ordering::SeqCst)
}

fn cancelled_error() -> String {
    INSTALL_CANCELLED.to_string()
}

pub fn is_cancelled_error(err: &str) -> bool {
    err == INSTALL_CANCELLED || err.starts_with(INSTALL_CANCELLED)
}

fn check_cancelled() -> Result<(), String> {
    if install_is_cancelled() {
        Err(cancelled_error())
    } else {
        Ok(())
    }
}

const R2_BUCKET: &str = "relaybase-mailbox";

/// Default manifest URL (override via RELAYBASE_INSTALL_MANIFEST_URL).
const DEFAULT_MANIFEST_URL: &str =
    "https://relaybase.xyz/downloads/worker-install-manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerInstallManifest {
    pub version: String,
    pub zip_url: String,
    pub zip_sha256: String,
    pub published_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerUpdateCheck {
    pub update_available: bool,
    pub latest_version: String,
    pub current_version: Option<String>,
    pub zip_url: Option<String>,
    pub zip_sha256: Option<String>,
}

/// D1 databases created during install. Each entry is (binding, db_name).
const D1_DATABASES: &[(&str, &str)] = &[
    ("RELAYBASE_LOGS", "relaybase-logs"),
    ("RELAYBASE_INBOX_INDEX", "relaybase-inbox-index"),
    ("RELAYBASE_DB", "relaybase-db"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoInstallResult {
    pub worker_url: String,
    pub worker_script_name: String,
    pub admin_token: String,
    pub r2_bucket: String,
    pub account_id: String,
    pub d1_logs_id: String,
    pub d1_inbox_index_id: String,
    pub d1_db_id: String,
    pub db_already_initialized: bool,
    pub db_applied: Vec<String>,
    pub worker_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResourceProbe {
    pub kind: String,
    pub name: String,
    pub present: bool,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProbeResult {
    pub account_id: String,
    pub resources: Vec<InstallResourceProbe>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallDecision {
    pub kind: String,
    pub name: String,
    pub action: String,
}

#[derive(Default)]
struct InstallPlan {
    reinstall_worker: bool,
    reinstall_r2: bool,
    reinstall_d1: Vec<String>,
}

impl InstallPlan {
    fn from_decisions(decisions: &[InstallDecision]) -> Self {
        let mut plan = Self::default();
        for d in decisions {
            if d.action != "reinstall" {
                continue;
            }
            match d.kind.as_str() {
                "worker" => plan.reinstall_worker = true,
                "r2" => plan.reinstall_r2 = true,
                "d1" => plan.reinstall_d1.push(d.name.clone()),
                _ => {}
            }
        }
        plan
    }

    fn should_reinstall_d1(&self, name: &str) -> bool {
        self.reinstall_d1.iter().any(|n| n == name)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    step: String,
    level: String,
    line: String,
}

fn manifest_url() -> String {
    env::var("RELAYBASE_INSTALL_MANIFEST_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MANIFEST_URL.to_string())
}

/// Fetch the hosted worker-install manifest (version + zip URL + sha256).
pub async fn fetch_install_manifest() -> Result<WorkerInstallManifest, String> {
    let url = manifest_url();
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Could not fetch install manifest ({url}): {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "Install manifest request failed (HTTP {}): {url}",
            res.status().as_u16()
        ));
    }
    res.json::<WorkerInstallManifest>()
        .await
        .map_err(|e| format!("Install manifest JSON invalid: {e}"))
}

fn versions_differ(current: Option<&str>, latest: &str) -> bool {
    let cur = current.unwrap_or("").trim();
    let lat = latest.trim();
    if lat.is_empty() {
        return false;
    }
    cur.is_empty() || cur != lat
}

/// Compare stored worker_version against the hosted manifest.
pub async fn check_worker_update(
    current_version: Option<String>,
) -> Result<WorkerUpdateCheck, String> {
    let manifest = fetch_install_manifest().await?;
    let update_available = versions_differ(current_version.as_deref(), &manifest.version);
    Ok(WorkerUpdateCheck {
        update_available,
        latest_version: manifest.version.clone(),
        current_version: current_version.filter(|v| !v.trim().is_empty()),
        zip_url: if update_available {
            Some(manifest.zip_url.clone())
        } else {
            None
        },
        zip_sha256: if update_available {
            Some(manifest.zip_sha256.clone())
        } else {
            None
        },
    })
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

async fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    check_cancelled()?;
    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Could not download install package ({url}): {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "Install package download failed (HTTP {}): {url}",
            res.status().as_u16()
        ));
    }
    res.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Could not read install package bytes: {e}"))
}

fn unzip_bytes(zip_bytes: &[u8], dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| format!("mkdir {dest:?}: {e}"))?;
    let zip_path = dest
        .parent()
        .ok_or("Invalid unzip destination")?
        .join(format!("relaybase-install-{}.zip", uuid::Uuid::new_v4()));
    std::fs::write(&zip_path, zip_bytes).map_err(|e| format!("write temp zip: {e}"))?;
    let status = std::process::Command::new("unzip")
        .args(["-o", "-q"])
        .arg(&zip_path)
        .arg("-d")
        .arg(dest)
        .status()
        .map_err(|e| format!("Could not run unzip (is it installed?): {e}"))?;
    let _ = std::fs::remove_file(&zip_path);
    if !status.success() {
        return Err(format!("unzip exited with status {status}"));
    }
    Ok(())
}

/// Prefer a freshly built `server/dist/worker-build/index.js` over the hosted
/// ZIP. The public 0.2.0 ZIP crashes on empty D1 during admin auth (no
/// `owner_config` table yet). Overlay is not debug-only — a local packaged
/// build on this machine still has `CARGO_MANIFEST_DIR` pointing at the repo.
fn overlay_local_worker_js(app: &AppHandle, work_dir: &Path) -> bool {
    let server = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../server");
    let local = [
        server.join("dist/relaybase-worker-install/worker.js"),
        server.join("dist/worker-build/index.js"),
        server.join("customer-install/worker.js"),
    ]
    .into_iter()
    .find(|p| p.is_file());
    let Some(local) = local else {
        emit_log(
            app,
            "prepare",
            "stderr",
            "No local worker.js overlay — hosted ZIP 0.2.0 will crash on empty D1. Run `pnpm run build:bundle` in server/.",
        );
        return false;
    };
    match std::fs::copy(&local, work_dir.join("worker.js")) {
        Ok(_) => {
            emit_log(
                app,
                "prepare",
                "info",
                format!("Using local worker.js ({})", local.display()),
            );
            if let Some(v) = read_staged_version(work_dir) {
                let tagged = if v.contains("+local") {
                    v
                } else {
                    format!("{v}+local")
                };
                let _ = std::fs::write(work_dir.join("VERSION"), format!("{tagged}\n"));
            }
            true
        }
        Err(e) => {
            emit_log(
                app,
                "prepare",
                "stderr",
                format!("Could not overlay local worker.js: {e}"),
            );
            false
        }
    }
}

/// Download the versioned install ZIP, verify SHA-256, and stage wrangler.toml + worker.js.
async fn stage_install_package(
    app: &AppHandle,
    manifest: &WorkerInstallManifest,
) -> Result<PathBuf, String> {
    emit_log(
        app,
        "prepare",
        "info",
        format!(
            "Downloading Worker install v{}…",
            manifest.version.trim()
        ),
    );
    let bytes = download_bytes(&manifest.zip_url).await?;
    let hash = sha256_hex(&bytes);
    if !manifest.zip_sha256.is_empty()
        && hash.to_lowercase() != manifest.zip_sha256.trim().to_lowercase()
    {
        return Err(format!(
            "Install package SHA-256 mismatch (expected {}, got {hash})",
            manifest.zip_sha256.trim()
        ));
    }
    let tmp = std::env::temp_dir().join(format!("relaybase-install-{}", uuid::Uuid::new_v4()));
    unzip_bytes(&bytes, &tmp)?;
    let nested = tmp.join("relaybase-worker-install");
    let work_dir = if nested.join("wrangler.toml").is_file() {
        nested
    } else if tmp.join("wrangler.toml").is_file() {
        tmp.clone()
    } else {
        return Err(
            "Install ZIP is missing wrangler.toml. Re-pack with pnpm pack:worker-install.".into(),
        );
    };
    if !work_dir.join("worker.js").is_file() {
        return Err(
            "Install ZIP is missing worker.js. Re-pack with pnpm pack:worker-install.".into(),
        );
    }
    let _ = overlay_local_worker_js(app, &work_dir);
    let staged = read_staged_version(&work_dir)
        .unwrap_or_else(|| manifest.version.trim().to_string());
    emit_log(
        app,
        "prepare",
        "info",
        format!("Staged Worker install v{staged} at {}", work_dir.display()),
    );
    Ok(work_dir)
}

/// Read version from staged VERSION file or wrangler.toml WORKER_VERSION var.
fn read_staged_version(work_dir: &Path) -> Option<String> {
    let version_file = work_dir.join("VERSION");
    if version_file.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&version_file) {
            let v = raw.trim();
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    let wrangler = work_dir.join("wrangler.toml");
    if wrangler.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&wrangler) {
            for line in raw.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("WORKER_VERSION") {
                    if let Some(rest) = trimmed.split('=').nth(1) {
                        let v = rest.trim().trim_matches('"');
                        if !v.is_empty() {
                            return Some(v.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

/// Backoff delays (seconds) between health-check retries after deploy (~30s total).
const WARMUP_BACKOFF_SECS: &[u64] = &[2, 4, 8, 16];

async fn probe_worker_health(worker_url: &str) -> Result<bool, String> {
    let value = fetch_worker_health_json(worker_url).await?;
    Ok(value.get("ok") == Some(&serde_json::Value::Bool(true)))
}

async fn fetch_worker_health_json(worker_url: &str) -> Result<serde_json::Value, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is empty".into());
    }
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{base}/health"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("health HTTP {}", res.status()));
    }
    let body = res.text().await.unwrap_or_default();
    serde_json::from_str(&body).map_err(|e| e.to_string())
}

/// New Worker builds expose `d1Bound`. Hosted ZIP 0.2.0 does not — that build
/// crashes on empty D1 during admin auth (not a D1 permission error).
async fn log_worker_health_shape(app: &AppHandle, worker_url: &str) {
    match fetch_worker_health_json(worker_url).await {
        Ok(health) => {
            let version = health
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("?");
            let d1_bound = health.get("d1Bound");
            match d1_bound {
                Some(bound) => emit_log(
                    app,
                    "warmup",
                    "info",
                    format!("Worker /health version={version} d1Bound={bound}"),
                ),
                None => emit_log(
                    app,
                    "warmup",
                    "stderr",
                    format!(
                        "Worker /health version={version} has no d1Bound — this is the hosted 0.2.0 ZIP. \
                         It can reach D1 but crashes on missing owner_config. Re-upload with the local overlay."
                    ),
                ),
            }
        }
        Err(e) => emit_log(
            app,
            "warmup",
            "info",
            format!("Could not read /health after warmup: {e}"),
        ),
    }
}

fn explain_init_db_failure(e: &str) -> String {
    let generic_old_build = e.contains("Internal server error") && !e.contains("\"detail\"");
    if generic_old_build {
        format!(
            "{e}\nThis is not a D1 permission error. Same-account Workers can use bound D1. \
             The hosted Worker still queries owner_config before migrations run, so init-db \
             and Verify both 500. Click Try again (not Verify now) so the local worker.js overlay is uploaded."
        )
    } else {
        e.to_string()
    }
}

/// Poll GET /health until the Worker responds or ~30s elapses (post-deploy warm-up).
async fn wait_for_worker_ready(app: &AppHandle, worker_url: &str) -> Result<(), String> {
    emit_log(
        app,
        "warmup",
        "info",
        format!("Waiting for {worker_url} to become reachable…"),
    );
    for attempt in 0..=WARMUP_BACKOFF_SECS.len() {
        if attempt > 0 {
            check_cancelled()?;
            let delay = WARMUP_BACKOFF_SECS[attempt - 1];
            emit_log(
                app,
                "warmup",
                "info",
                format!(
                    "Worker not ready yet — retrying in {delay}s (attempt {}/{})…",
                    attempt + 1,
                    WARMUP_BACKOFF_SECS.len() + 1
                ),
            );
            tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;
            check_cancelled()?;
        }
        match probe_worker_health(worker_url).await {
            Ok(true) => {
                emit_log(
                    app,
                    "warmup",
                    "info",
                    format!("Worker is reachable (attempt {})", attempt + 1),
                );
                return Ok(());
            }
            Ok(false) => {}
            Err(e) => {
                emit_log(
                    app,
                    "warmup",
                    "info",
                    format!("Health check failed (attempt {}): {e}", attempt + 1),
                );
            }
        }
    }
    emit_log(
        app,
        "warmup",
        "stderr",
        "Worker did not respond to /health within ~30s — continuing anyway. You can verify manually.",
    );
    Ok(())
}

async fn fetch_worker_version(worker_url: &str, admin_token: &str) -> Option<String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() || admin_token.trim().is_empty() {
        return None;
    }
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{base}/console/connect"))
        .header("Authorization", format!("Bearer {}", admin_token.trim()))
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    let body = res.text().await.ok()?;
    let value: serde_json::Value = serde_json::from_str(&body).ok()?;
    value
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && s != "unknown")
}

fn generate_admin_token() -> String {
    // 32 hex chars = 128 bits of entropy (two uuid v4s concatenated).
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

fn emit_log(app: &AppHandle, step: &str, level: &str, line: impl Into<String>) {
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: step.into(),
            level: level.into(),
            line: line.into(),
        },
    );
}

/// Delete every Relaybase install resource in the account (Worker, D1, R2).
/// Streams the same `install-log` events as auto-install.
pub async fn rollback_all_install(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
) -> Result<(), String> {
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("A Cloudflare API token is required.".into());
    }
    emit_log(
        &app,
        "rollback",
        "info",
        "Starting rollback — removing Worker, D1, and R2…",
    );
    let account_id = match account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
    {
        Some(id) => id,
        None => {
            emit_log(
                &app,
                "rollback",
                "info",
                "Resolving Cloudflare account id from API token…",
            );
            resolve_account_id(&api_token).await?
        }
    };
    let client = CfClient {
        account_id: account_id.clone(),
        api_token: api_token.clone(),
    };

    emit_log(
        &app,
        "rollback",
        "info",
        format!("Deleting Worker `{DEFAULT_SCRIPT}`…"),
    );
    match delete_worker_script(&client, DEFAULT_SCRIPT).await {
        Ok(()) => emit_log(
            &app,
            "rollback",
            "info",
            format!("Deleted Worker `{DEFAULT_SCRIPT}`"),
        ),
        Err(e) => emit_log(&app, "rollback", "stderr", format!("Worker delete: {e}")),
    }

    emit_log(&app, "rollback", "info", "Looking up D1 databases…");
    let d1_wanted: Vec<&str> = D1_DATABASES.iter().map(|(_, name)| *name).collect();
    match list_d1_databases(&client).await {
        Ok(all) => {
            let mut found = 0u32;
            for (name, id) in all {
                if !d1_wanted.contains(&name.as_str()) {
                    continue;
                }
                found += 1;
                emit_log(
                    &app,
                    "rollback",
                    "info",
                    format!("Deleting D1 {name} ({id})…"),
                );
                match delete_d1_database(&client, &id).await {
                    Ok(()) => emit_log(&app, "rollback", "info", format!("Deleted D1 {name}")),
                    Err(e) => {
                        emit_log(&app, "rollback", "stderr", format!("D1 {name} delete: {e}"))
                    }
                }
            }
            if found == 0 {
                emit_log(&app, "rollback", "info", "No Relaybase D1 databases found");
            }
        }
        Err(e) => emit_log(&app, "rollback", "stderr", format!("D1 list failed: {e}")),
    }

    emit_log(
        &app,
        "rollback",
        "info",
        format!("Emptying R2 bucket {R2_BUCKET}…"),
    );
    match empty_r2_bucket(&client, R2_BUCKET).await {
        Ok(n) => emit_log(
            &app,
            "rollback",
            "info",
            format!("Removed {n} object(s) from {R2_BUCKET}"),
        ),
        Err(e) => emit_log(&app, "rollback", "stderr", format!("R2 empty: {e}")),
    }
    emit_log(
        &app,
        "rollback",
        "info",
        format!("Deleting R2 bucket {R2_BUCKET}…"),
    );
    match delete_r2_bucket(&client, R2_BUCKET).await {
        Ok(()) => emit_log(
            &app,
            "rollback",
            "info",
            format!("Deleted R2 bucket {R2_BUCKET}"),
        ),
        Err(e) => emit_log(&app, "rollback", "stderr", format!("R2 delete: {e}")),
    }

    emit_log(&app, "rollback", "info", "Rollback finished.");
    Ok(())
}

pub async fn probe_install_resources(
    api_token: String,
    account_id: Option<String>,
) -> Result<InstallProbeResult, String> {
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("A Cloudflare API token is required.".into());
    }
    let account_id = match account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
    {
        Some(id) => id,
        None => resolve_account_id(&api_token).await?,
    };
    let client = CfClient {
        account_id: account_id.clone(),
        api_token: api_token.clone(),
    };
    assert_r2_subscription(&client).await?;

    let mut resources = Vec::new();
    // OAuth write tokens often 403 on account-wide lists. Existence helpers
    // already treat that as "not present" so first-time install can proceed.
    let worker_present = worker_script_exists(&client, DEFAULT_SCRIPT).await?;
    resources.push(InstallResourceProbe {
        kind: "worker".into(),
        name: DEFAULT_SCRIPT.into(),
        present: worker_present,
        id: String::new(),
    });
    let r2_present = find_r2_bucket(&client, R2_BUCKET).await?;
    resources.push(InstallResourceProbe {
        kind: "r2".into(),
        name: R2_BUCKET.into(),
        present: r2_present,
        id: String::new(),
    });
    let d1_list = match list_d1_databases(&client).await {
        Ok(v) => v,
        Err(_) => Vec::new(),
    };
    for (_binding, name) in D1_DATABASES {
        let id = d1_list
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, id)| id.clone())
            .unwrap_or_default();
        resources.push(InstallResourceProbe {
            kind: "d1".into(),
            name: (*name).into(),
            present: !id.is_empty(),
            id,
        });
    }
    Ok(InstallProbeResult {
        account_id,
        resources,
    })
}

#[derive(Default)]
struct InstallRunOptions {
    /// When set, reuse this admin token instead of generating a new one (Worker update).
    existing_admin_token: Option<String>,
    /// When true, skip ADMIN_TOKEN secret put (update keeps existing secret).
    skip_admin_secret: bool,
}

pub async fn auto_install_worker(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
    decisions: Vec<InstallDecision>,
) -> Result<AutoInstallResult, String> {
    reset_install_cancel();
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("A Cloudflare API token is required.".into());
    }
    let server_token = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // Resolve the Cloudflare account id (use the provided one, else look it up)
    // so we can push CF_ACCOUNT_ID as a Worker secret alongside CF_API_TOKEN.
    let account_id = match account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
    {
        Some(id) => id,
        None => {
            let _ = app.emit(
                "install-log",
                LogEvent {
                    step: "prepare".into(),
                    level: "info".into(),
                    line: "Resolving Cloudflare account id from API token…".into(),
                },
            );
            resolve_account_id(&api_token).await?
        }
    };

    let manifest = fetch_install_manifest().await?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "prepare".into(),
            level: "info".into(),
            line: format!(
                "Using Worker install manifest v{}",
                manifest.version.trim()
            ),
        },
    );

    let work_dir = stage_install_package(&app, &manifest).await?;
    if install_is_cancelled() {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(cancelled_error());
    }

    let result = auto_install_steps(
        &app,
        &work_dir,
        &api_token,
        &account_id,
        server_token.as_deref(),
        &InstallPlan::from_decisions(&decisions),
        &InstallRunOptions::default(),
        read_staged_version(&work_dir),
    )
    .await;
    let _ = std::fs::remove_dir_all(&work_dir);
    result
}

/// Re-deploy the Worker from the latest hosted install ZIP (keeps ADMIN_TOKEN + D1).
pub async fn update_installed_worker(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
    existing_admin_token: String,
) -> Result<AutoInstallResult, String> {
    reset_install_cancel();
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("A Cloudflare API token is required.".into());
    }
    let admin = existing_admin_token.trim().to_string();
    if admin.is_empty() {
        return Err("Admin token is required to update the Worker.".into());
    }
    let server_token = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let account_id = match account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
    {
        Some(id) => id,
        None => resolve_account_id(&api_token).await?,
    };

    let manifest = fetch_install_manifest().await?;
    let work_dir = stage_install_package(&app, &manifest).await?;
    if install_is_cancelled() {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(cancelled_error());
    }

    let mut run_opts = InstallRunOptions::default();
    run_opts.existing_admin_token = Some(admin.clone());
    run_opts.skip_admin_secret = true;

    let result = auto_install_steps(
        &app,
        &work_dir,
        &api_token,
        &account_id,
        server_token.as_deref(),
        &InstallPlan::default(),
        &run_opts,
        read_staged_version(&work_dir),
    )
    .await;
    let _ = std::fs::remove_dir_all(&work_dir);
    result
}

async fn auto_install_steps(
    app: &AppHandle,
    work_dir: &Path,
    api_token: &str,
    account_id: &str,
    server_token: Option<&str>,
    plan: &InstallPlan,
    run_opts: &InstallRunOptions,
    staged_version: Option<String>,
) -> Result<AutoInstallResult, String> {
    check_cancelled()?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "prepare".into(),
            level: "info".into(),
            line: "Skipping KV — product state is D1 + R2; ADMIN_TOKEN is a Worker secret."
                .into(),
        },
    );

    let client = CfClient {
        account_id: account_id.to_string(),
        api_token: api_token.to_string(),
    };

    // R2 must be on this account before we delete or create anything.
    // Cloudflare sometimes drops the unused $0 subscription after a few days.
    emit_log(
        app,
        "r2",
        "info",
        "Checking that R2 is enabled on this Cloudflare account…",
    );
    assert_r2_subscription(&client).await?;

    if plan.reinstall_worker {
        emit_log(
            app,
            "prepare",
            "info",
            format!("Reinstall — deleting Worker `{DEFAULT_SCRIPT}`…"),
        );
        delete_worker_script(&client, DEFAULT_SCRIPT).await?;
    }

    if plan.reinstall_r2 {
        emit_log(
            app,
            "r2",
            "info",
            format!("Reinstall — emptying and deleting R2 {R2_BUCKET}…"),
        );
        let _ = empty_r2_bucket(&client, R2_BUCKET).await;
        delete_r2_bucket(&client, R2_BUCKET).await?;
    }

    // 1) R2 bucket (reuse if it already exists unless we just deleted it).
    emit_log(
        app,
        "r2",
        "info",
        format!("Ensuring R2 bucket {R2_BUCKET}…"),
    );
    ensure_r2_bucket(&client, R2_BUCKET).await?;
    check_cancelled()?;
    emit_log(
        app,
        "r2",
        "info",
        format!("R2 bucket {R2_BUCKET} ready"),
    );

    // 2) D1 databases — create (or reuse). Migrations are NOT applied here —
    //    the Worker owns its schema via POST /console/init-db after deploy.
    let existing_d1 = list_d1_databases(&client).await.unwrap_or_default();
    let mut d1_ids: Vec<String> = Vec::with_capacity(D1_DATABASES.len());
    for (_binding, db_name) in D1_DATABASES {
        let db_id = if plan.should_reinstall_d1(db_name) {
            if let Some((_, id)) = existing_d1.iter().find(|(n, _)| n == db_name) {
                emit_log(
                    app,
                    "d1",
                    "info",
                    format!("Reinstall — deleting D1 {db_name}…"),
                );
                delete_d1_database(&client, id).await?;
            }
            emit_log(app, "d1", "info", format!("Creating D1 {db_name}…"));
            create_d1_database(&client, db_name).await?
        } else if let Some((_, id)) = existing_d1.iter().find(|(n, _)| n == db_name) {
            emit_log(
                app,
                "d1",
                "info",
                format!("D1 {db_name} already exists — skipping create (id {id})"),
            );
            id.clone()
        } else {
            emit_log(app, "d1", "info", format!("Creating D1 {db_name}…"));
            create_d1_database(&client, db_name).await?
        };
        check_cancelled()?;
        emit_log(
            app,
            "d1",
            "info",
            format!("D1 {db_name} ready (id {db_id}) — schema will be initialized by the Worker"),
        );
        if db_id.trim().is_empty() {
            return Err(format!(
                "D1 {db_name} has no database id — cannot bind it to the Worker."
            ));
        }
        d1_ids.push(db_id);
    }

    // 3) Deploy pre-built worker.js with R2 + D1 bindings, then secrets.
    //    Secrets must be set after the script exists.
    check_cancelled()?;
    let js_path = work_dir.join("worker.js");
    let js_source = std::fs::read_to_string(&js_path)
        .map_err(|e| format!("read staged worker.js: {e}"))?;
    let version = staged_version.clone().unwrap_or_else(|| "unknown".into());
    let d1_for_upload: Vec<(&str, &str)> = D1_DATABASES
        .iter()
        .zip(d1_ids.iter())
        .map(|((binding, _), id)| (*binding, id.as_str()))
        .collect();
    emit_log(
        app,
        "deploy",
        "info",
        format!("Uploading Worker `{DEFAULT_SCRIPT}`…"),
    );
    upload_worker_script(
        &client,
        DEFAULT_SCRIPT,
        &js_source,
        R2_BUCKET,
        &d1_for_upload,
        &version,
    )
    .await?;
    match list_worker_bindings(&client, DEFAULT_SCRIPT).await {
        Ok(bindings) => {
            let summary = if bindings.is_empty() {
                "(none)".into()
            } else {
                bindings
                    .iter()
                    .map(|(kind, name)| format!("{kind}:{name}"))
                    .collect::<Vec<_>>()
                    .join(", ")
            };
            emit_log(app, "deploy", "info", format!("Worker bindings: {summary}"));
            let d1_bound = D1_DATABASES
                .iter()
                .filter(|(binding, _)| {
                    bindings
                        .iter()
                        .any(|(kind, name)| kind == "d1" && name == *binding)
                })
                .count();
            if d1_bound < D1_DATABASES.len() {
                return Err(format!(
                    "Worker uploaded but D1 bindings are missing ({d1_bound}/{}). \
                     Same-account D1 does not need extra Worker permissions — the \
                     script upload did not attach RELAYBASE_DB / LOGS / INBOX_INDEX.",
                    D1_DATABASES.len()
                ));
            }
        }
        Err(e) => emit_log(
            app,
            "deploy",
            "info",
            format!("Could not list Worker bindings after upload: {e}"),
        ),
    }
    if let Err(e) = put_worker_schedules(&client, DEFAULT_SCRIPT, DEFAULT_WORKER_CRON).await {
        emit_log(
            app,
            "deploy",
            "stderr",
            format!("Could not set Worker cron ({DEFAULT_WORKER_CRON}): {e}"),
        );
    }
    let worker_url = enable_workers_dev(&client, DEFAULT_SCRIPT).await?;
    emit_log(
        app,
        "deploy",
        "info",
        format!("Deployed at {worker_url}"),
    );

    let admin_token = if let Some(existing) = run_opts.existing_admin_token.as_ref() {
        existing.clone()
    } else {
        generate_admin_token()
    };
    if !run_opts.skip_admin_secret {
        put_worker_secret(&client, DEFAULT_SCRIPT, "ADMIN_TOKEN", &admin_token).await?;
        emit_log(app, "secret", "info", "ADMIN_TOKEN secret set");
    } else {
        emit_log(
            app,
            "secret",
            "info",
            "ADMIN_TOKEN unchanged — reusing existing secret",
        );
    }

    put_worker_secret(&client, DEFAULT_SCRIPT, "CF_ACCOUNT_ID", account_id).await?;
    emit_log(app, "secret", "info", "CF_ACCOUNT_ID secret set");

    if let Some(server) = server_token {
        put_worker_secret(&client, DEFAULT_SCRIPT, "CF_API_TOKEN", server).await?;
        emit_log(
            app,
            "secret",
            "info",
            "CF_API_TOKEN secret set (server token)",
        );
    } else {
        emit_log(
            app,
            "secret",
            "info",
            "CF_API_TOKEN skipped — set the server token (Email Sending Edit) in Settings to enable sending.",
        );
    }

    wait_for_worker_ready(app, &worker_url).await?;
    log_worker_health_shape(app, &worker_url).await;

    // 5) Initialize D1 schema via the Worker's own endpoint.
    //    The desktop never applies SQL — the Worker owns its schema.
    let init = init_worker_db_with_retry(app, &worker_url, &admin_token, false).await;
    let (db_already_initialized, db_applied) = match init {
        Ok(r) => {
            emit_log(
                app,
                "init-db",
                "info",
                if r.already_initialized {
                    "D1 already initialized — existing data kept".to_string()
                } else {
                    format!("D1 schema initialized ({} migrations applied)", r.applied.len())
                },
            );
            (r.already_initialized, r.applied)
        }
        Err(e) => {
            emit_log(
                app,
                "init-db",
                "stderr",
                format!("Worker init-db call failed: {e}"),
            );
            return Err(explain_init_db_failure(&e));
        }
    };

    let worker_version = fetch_worker_version(&worker_url, &admin_token)
        .await
        .or(staged_version)
        .unwrap_or_else(|| "unknown".to_string());

    Ok(AutoInstallResult {
        worker_url,
        worker_script_name: DEFAULT_SCRIPT.to_string(),
        admin_token,
        r2_bucket: R2_BUCKET.to_string(),
        account_id: account_id.to_string(),
        d1_logs_id: d1_ids.get(0).cloned().unwrap_or_default(),
        d1_inbox_index_id: d1_ids.get(1).cloned().unwrap_or_default(),
        d1_db_id: d1_ids.get(2).cloned().unwrap_or_default(),
        db_already_initialized,
        db_applied,
        worker_version,
    })
}

/// Result from the Worker's POST /console/init-db endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitDbResult {
    pub ok: bool,
    pub already_initialized: bool,
    pub applied: Vec<String>,
    pub skipped: Vec<String>,
    pub cleared: bool,
}

async fn init_worker_db_with_retry(
    app: &AppHandle,
    worker_url: &str,
    admin_token: &str,
    clear: bool,
) -> Result<InitDbResult, String> {
    const ATTEMPTS: u32 = 4;
    let mut last = String::new();
    for attempt in 1..=ATTEMPTS {
        match init_worker_db(worker_url, admin_token, clear).await {
            Ok(r) => return Ok(r),
            Err(e) => {
                last = e;
                let transient = last.contains("1042")
                    || last.contains("404")
                    || last.contains("1101")
                    || last.to_lowercase().contains("not found");
                if attempt == ATTEMPTS || !transient {
                    break;
                }
                emit_log(
                    app,
                    "init-db",
                    "info",
                    format!("init-db not ready yet (attempt {attempt}/{ATTEMPTS}) — retrying…"),
                );
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }
    Err(last)
}

/// Call the Worker's POST /console/init-db endpoint to initialize D1 schema.
/// The Worker owns its own migrations — the desktop never runs SQL.
pub async fn init_worker_db(
    worker_url: &str,
    admin_token: &str,
    clear: bool,
) -> Result<InitDbResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is empty".into());
    }
    let url = format!("{base}/console/init-db");
    let body = serde_json::json!({ "clear": clear });
    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {admin_token}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("init-db request failed: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("init-db returned {status}: {text}"));
    }
    res.json::<InitDbResult>()
        .await
        .map_err(|e| format!("init-db response parse failed: {e}"))
}

/// Merge an auto-install result into stored credentials (preserves
/// Relaybase account + CF account id if already present). Also persists the
/// install token used (so later update/relink work without re-entering) and
/// the server token + pushed-at timestamp when one was supplied.
pub fn merge_into_credentials(
    existing: &StoredCredentials,
    result: &AutoInstallResult,
    account_id: Option<String>,
) -> StoredCredentials {
    StoredCredentials {
        account_id: account_id
            .filter(|a| !a.trim().is_empty())
            .or_else(|| (!result.account_id.is_empty()).then(|| result.account_id.clone()))
            .unwrap_or_else(|| existing.account_id.clone()),
        // install_token is filled by the caller via save_cf_credentials or the
        // auto_install_routing_worker command before merge; preserve existing.
        install_token: existing.install_token.clone(),
        server_token: existing.server_token.clone(),
        server_token_pushed_at: existing.server_token_pushed_at.clone(),
        worker_url: result.worker_url.clone(),
        admin_token: result.admin_token.clone(),
        worker_script_name: result.worker_script_name.clone(),
        worker_version: if result.worker_version.trim().is_empty() {
            existing.worker_version.clone()
        } else {
            result.worker_version.clone()
        },
        license_key: existing.license_key.clone(),
        relaybase_account_id: existing.relaybase_account_id.clone(),
        relaybase_email: existing.relaybase_email.clone(),
        relaybase_session: existing.relaybase_session.clone(),
        relaybase_tier: existing.relaybase_tier.clone(),
        cf_oauth_access_token: existing.cf_oauth_access_token.clone(),
        cf_oauth_refresh_token: existing.cf_oauth_refresh_token.clone(),
        cf_oauth_access_expires_at: existing.cf_oauth_access_expires_at.clone(),
        cf_oauth_account_id: existing.cf_oauth_account_id.clone(),
    }
}

/// PUT the Worker `CF_API_TOKEN` secret using the install (OAuth) token
/// for API auth and the server token as the secret value. Used by Settings
/// after install.
pub async fn push_cf_api_token_secret(
    account_id: &str,
    script_name: &str,
    install_token: &str,
    server_token: &str,
) -> Result<String, String> {
    if script_name.is_empty() {
        return Err("No deployed Worker script name found.".into());
    }
    if install_token.is_empty() {
        return Err("Install token (Workers Scripts Edit) is required to push secrets.".into());
    }
    if server_token.is_empty() {
        return Err("Server token is empty.".into());
    }
    let account_id = if account_id.trim().is_empty() {
        resolve_account_id(install_token).await?
    } else {
        account_id.trim().to_string()
    };
    let client = CfClient {
        account_id,
        api_token: install_token.to_string(),
    };
    put_worker_secret(&client, script_name, "CF_API_TOKEN", server_token).await?;
    Ok(now_iso())
}

pub fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Simple fixed-offset ISO-ish timestamp; precision is not important for
    // display, only "was it pushed after the last save".
    let days = secs / 86_400;
    let secs_of_day = secs % 86_400;
    let h = secs_of_day / 3600;
    let m = (secs_of_day % 3600) / 60;
    let s = secs_of_day % 60;
    // 1970-01-01 + days — approximate date math (good enough for a label).
    let (y, mo, dd) = days_to_ymd(days as i64);
    format!("{y:04}-{mo:02}-{dd:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(days: i64) -> (i64, i64, i64) {
    // Civil-from-days algorithm (Howard Hinnant). days since 1970-01-01.
    let z = days + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + (if m <= 2 { 1 } else { 0 });
    (y, m, d)
}
