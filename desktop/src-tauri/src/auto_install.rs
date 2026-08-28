//! Background auto-install of the Relaybase routing Worker into the user's
//! Cloudflare account using a pre-built install ZIP + the Cloudflare HTTP API.
//!
//! Flow (each step streams `install-log` events to the frontend):
//!   0. `probe_install_resources` lists Worker / R2 / D1 and their occupancy.
//!   1. Fetch worker-install-manifest.json and download the versioned ZIP.
//!   2. Ensure R2 bucket `relaybase-mailbox`.
//!   3. Create D1 databases (empty D1s only — schema via POST /console/init-db).
//!   4. Generate an admin token; PUT Worker secrets.
//!   5. PUT `worker.js` with bindings; enable workers.dev.
//!   6. Empty D1s: POST /console/init-db. Reused or Worker-update: POST /console/migrate-db.
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
    account_workers_dev_url, assert_r2_subscription, count_d1_user_rows, count_r2_objects,
    create_d1_database, delete_d1_database, delete_r2_bucket, delete_worker_script,
    empty_r2_bucket, enable_workers_dev, ensure_r2_bucket, find_r2_bucket, list_d1_databases,
    list_worker_bindings, put_worker_schedules, put_worker_secret, resolve_account_id,
    upload_worker_script, worker_script_exists, CfClient, DEFAULT_WORKER_CRON,
};
use crate::secrets::{load_credentials, StoredCredentials};
use crate::worker::DEFAULT_SCRIPT;

/// Returned to the UI when the user stops install. Keep this token stable.
pub const INSTALL_CANCELLED: &str = "INSTALL_CANCELLED";
/// OAuth account's workers.dev URL does not match the saved Worker.
pub const WORKER_URL_ACCOUNT_MISMATCH: &str = "WORKER_URL_ACCOUNT_MISMATCH";

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
    #[serde(default)]
    pub notes: Option<String>,
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
    ("RELAYBASE_MAIL", "relaybase-mail"),
    ("RELAYBASE_DB", "relaybase-db"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoInstallResult {
    pub worker_url: String,
    pub worker_script_name: String,
    /// AUTH_PEPPER just set on the Worker. Held in JS memory only during
    /// setup-admin; never written to ~/.relaybase.
    pub auth_pepper: String,
    /// Always empty — kept so older JS still deserializes.
    #[serde(default)]
    pub admin_token: String,
    pub r2_bucket: String,
    pub account_id: String,
    pub d1_logs_id: String,
    pub d1_mail_id: String,
    pub d1_db_id: String,
    pub db_already_initialized: bool,
    pub db_applied: Vec<String>,
    pub worker_version: String,
}

/// Compare the saved Worker URL with the workers.dev URL of the OAuth account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerUpdateTarget {
    pub expected_worker_url: String,
    pub oauth_account_id: String,
    pub oauth_worker_url: String,
    pub connected_account_id: String,
    pub matches: bool,
}

pub fn worker_url_host(raw: &str) -> Option<String> {
    let trimmed = raw.trim().trim_end_matches('/').to_lowercase();
    let rest = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))?;
    let host = rest.split('/').next()?.trim();
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

pub fn worker_urls_match(expected: &str, oauth: &str) -> bool {
    match (worker_url_host(expected), worker_url_host(oauth)) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

fn is_workers_dev_url(raw: &str) -> bool {
    worker_url_host(raw)
        .map(|h| h.ends_with(".workers.dev"))
        .unwrap_or(false)
}

fn mismatch_error(expected: &str, oauth: &str) -> String {
    format!(
        "{WORKER_URL_ACCOUNT_MISMATCH}: This Cloudflare login is a different account than your saved Worker.\n\
         Saved Worker: {expected}\n\
         This login would update: {oauth}\n\
         Authorize again and choose the Cloudflare account that owns your Worker. No script was uploaded."
    )
}

async fn peek_worker_account_id(worker_url: &str, admin_token: &str) -> Option<String> {
    let base = worker_url.trim().trim_end_matches('/');
    let token = admin_token.trim();
    if base.is_empty() || token.is_empty() {
        return None;
    }
    let http = reqwest::Client::new();
    let res = http
        .get(format!("{base}/console/connect"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    let value: serde_json::Value = res.json().await.ok()?;
    value
        .get("accountId")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

/// Resolve the OAuth account's workers.dev URL and compare it to the saved Worker.
/// Custom-domain installs match when `/console/connect` reports the same account id.
pub async fn preview_worker_update_target(
    api_token: &str,
    account_id: &str,
    expected_worker_url: &str,
    script_name: &str,
) -> Result<WorkerUpdateTarget, String> {
    let expected = expected_worker_url.trim().trim_end_matches('/').to_string();
    if expected.is_empty() {
        return Err("No Worker URL saved. Complete install first.".into());
    }
    if account_id.trim().is_empty() {
        return Err("Authorize with Cloudflare first.".into());
    }
    let script = if script_name.trim().is_empty() {
        DEFAULT_SCRIPT
    } else {
        script_name.trim()
    };
    let client = CfClient {
        account_id: account_id.trim().to_string(),
        api_token: api_token.trim().to_string(),
    };
    let oauth_worker_url = account_workers_dev_url(&client, script).await?;
    let access = crate::owner_session::current_access_token().unwrap_or_default();
    let connected_account_id = peek_worker_account_id(&expected, &access)
        .await
        .unwrap_or_default();
    let url_match = worker_urls_match(&expected, &oauth_worker_url);
    let account_match = !connected_account_id.is_empty()
        && connected_account_id.eq_ignore_ascii_case(account_id.trim());
    let matches = url_match || (!is_workers_dev_url(&expected) && account_match);
    Ok(WorkerUpdateTarget {
        expected_worker_url: expected,
        oauth_account_id: account_id.trim().to_string(),
        oauth_worker_url,
        connected_account_id,
        matches,
    })
}

pub fn assert_worker_update_target_matches(target: &WorkerUpdateTarget) -> Result<(), String> {
    if target.matches {
        Ok(())
    } else {
        Err(mismatch_error(
            &target.expected_worker_url,
            &target.oauth_worker_url,
        ))
    }
}

/// Typed confirmation required before wiping occupied R2 / D1.
pub const WIPE_PHRASE_DELETE_ME: &str = "DELETE ME";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResourceProbe {
    pub kind: String,
    pub name: String,
    pub present: bool,
    pub id: String,
    #[serde(default)]
    pub object_count: Option<u64>,
    #[serde(default)]
    pub row_count: Option<u64>,
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub occupied: bool,
}

impl InstallResourceProbe {
    fn base(kind: &str, name: impl Into<String>, present: bool, id: impl Into<String>) -> Self {
        Self {
            kind: kind.into(),
            name: name.into(),
            present,
            id: id.into(),
            object_count: None,
            row_count: None,
            truncated: false,
            occupied: false,
        }
    }
}

/// `DELETE ME`, the Worker script name, or any of `resource_names`.
pub fn wipe_confirmation_allows(phrase: Option<&str>, resource_names: &[&str]) -> bool {
    let Some(p) = phrase.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    p == WIPE_PHRASE_DELETE_ME
        || p == DEFAULT_SCRIPT
        || resource_names.iter().any(|n| *n == p)
}

fn assert_wipe_phrase(phrase: Option<&str>, resource_names: &[&str]) -> Result<(), String> {
    if wipe_confirmation_allows(phrase, resource_names) {
        Ok(())
    } else {
        Err(format!(
            "{} already has data. Type DELETE ME or the resource name to permanently delete it.",
            resource_names.join(", ")
        ))
    }
}

fn occupied_wipe_refused(occupied: &[&InstallResourceProbe]) -> String {
    let summary = occupied
        .iter()
        .map(|r| {
            if r.kind == "r2" {
                let n = r.object_count.unwrap_or(0);
                let plus = if r.truncated { "+" } else { "" };
                format!("{} ({n}{plus} objects)", r.name)
            } else {
                let n = r.row_count.unwrap_or(0);
                let plus = if r.truncated { "+" } else { "" };
                format!("{} ({n}{plus} rows)", r.name)
            }
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "These resources already have data ({summary}). Type DELETE ME or the resource name to permanently delete them."
    )
}

fn assert_occupied_wipe_allowed(
    occupied: &[&InstallResourceProbe],
    wipe_confirmation: Option<&str>,
) -> Result<(), String> {
    if occupied.is_empty() {
        return Ok(());
    }
    let names: Vec<&str> = occupied.iter().map(|r| r.name.as_str()).collect();
    if wipe_confirmation_allows(wipe_confirmation, &names) {
        Ok(())
    } else {
        Err(occupied_wipe_refused(occupied))
    }
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

/// Current Worker `/health` exposes `d1Bound` and `schemaMigrate: reconcile-v1`.
fn worker_js_is_current(source: &str) -> bool {
    source.contains("d1Bound") && source.contains("reconcile-v1")
}

fn parse_digits_after(hay: &str, needle: &str) -> Option<u32> {
    let lower = hay.to_ascii_lowercase();
    let idx = lower.find(needle)?;
    let rest = hay[idx + needle.len()..].trim_start_matches([' ', ':', '"', '=']);
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 3 && digits.len() <= 5 {
        digits.parse().ok()
    } else {
        None
    }
}

fn extract_cf_error_code(text: &str) -> Option<u32> {
    parse_digits_after(text, "error code")
        .or_else(|| parse_digits_after(text, "\"code\""))
        .or_else(|| parse_digits_after(text, "code:"))
}

fn cf_worker_code_hint(code: u32) -> Option<&'static str> {
    Some(match code {
        1101 => {
            "Cloudflare 1101: the Worker threw a JavaScript exception. Open Cloudflare → Workers → relaybase-api → Logs for the stack."
        }
        1102 => {
            "Cloudflare 1102: the Worker exceeded its CPU time limit on this request."
        }
        1103 => {
            "Cloudflare 1103: this account's Workers runtime needs Cloudflare Support."
        }
        1104 => {
            "Cloudflare 1104: the runtime cancelled this Worker request (startup/isolate, not a Relaybase version mismatch). Common right after deploy — wait and retry."
        }
        1027 => "Cloudflare 1027: this account hit the Workers free-tier daily request limit.",
        1042 => {
            "Cloudflare 1042: a Worker-to-Worker fetch was blocked. Retry after deploy usually works."
        }
        1015 => "Cloudflare 1015: rate limited. Wait a moment and retry.",
        _ => return None,
    })
}

fn format_worker_http_error(endpoint: &str, status: impl std::fmt::Display, body: &str) -> String {
    let trimmed = body.trim();
    let json: Option<serde_json::Value> = serde_json::from_str(trimmed).ok();
    let json_line = json.as_ref().and_then(|v| {
        let err = v.get("error").and_then(|x| x.as_str()).unwrap_or("").trim();
        let det = v.get("detail").and_then(|x| x.as_str()).unwrap_or("").trim();
        if err.is_empty() && det.is_empty() {
            None
        } else if det.is_empty() {
            Some(err.to_string())
        } else if err.is_empty() {
            Some(det.to_string())
        } else {
            Some(format!("{err} — {det}"))
        }
    });
    let code = extract_cf_error_code(trimmed);
    let hint = code.and_then(cf_worker_code_hint);
    let mut parts = vec![format!("{endpoint} returned {status}")];
    if let Some(line) = json_line {
        parts.push(line);
    } else if !trimmed.is_empty() {
        let excerpt: String = trimmed.chars().take(280).collect();
        parts.push(excerpt);
    }
    if let Some(h) = hint {
        parts.push(h.to_string());
    } else if let Some(c) = code {
        parts.push(format!(
            "Cloudflare error code {c}. This is a Workers runtime / edge error, not a Relaybase version label."
        ));
    }
    parts.join("\n")
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
    let staged_js = std::fs::read_to_string(work_dir.join("worker.js"))
        .map_err(|e| format!("Could not read staged worker.js: {e}"))?;
    if !worker_js_is_current(&staged_js) {
        return Err(
            "The hosted install ZIP is too old to initialize an empty database (no d1Bound in worker.js). \
             Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again."
                .into(),
        );
    }
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

/// Log `/health` shape. Missing `d1Bound` means the hosted ZIP is stale.
async fn log_worker_health_shape(app: &AppHandle, worker_url: &str) {
    match fetch_worker_health_json(worker_url).await {
        Ok(health) => {
            let version = health
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("?");
            let d1_bound = health.get("d1Bound");
            let schema_migrate = health
                .get("schemaMigrate")
                .and_then(|v| v.as_str())
                .unwrap_or("missing");
            match d1_bound {
                Some(bound) => emit_log(
                    app,
                    "warmup",
                    "info",
                    format!(
                        "Worker /health version={version} schemaMigrate={schema_migrate} d1Bound={bound}"
                    ),
                ),
                None => {
                    emit_log(
                        app,
                        "warmup",
                        "stderr",
                        format!(
                            "Worker /health version={version} has no d1Bound — the hosted install ZIP is stale. Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again."
                        ),
                    );
                }
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
    if let Some(hint) = extract_cf_error_code(e).and_then(cf_worker_code_hint) {
        if e.contains(hint) {
            return e.to_string();
        }
        return format!("{e}\n{hint}");
    }
    if e.contains("owner_config") && e.contains("no such table") {
        return format!(
            "{e}\nThe Worker ran admin auth against D1 before migrations. Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again."
        );
    }
    e.to_string()
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

async fn fetch_worker_version(worker_url: &str) -> Option<String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return None;
    }
    let client = reqwest::Client::new();
    let res = client.get(format!("{base}/health")).send().await.ok()?;
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

fn generate_auth_pepper() -> String {
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
/// Occupied R2 / D1 require `wipe_confirmation` (`DELETE ME` or a resource name).
pub async fn rollback_all_install(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    wipe_confirmation: Option<String>,
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
        "Checking for existing mail and database data before deleting…",
    );
    match probe_install_resources(api_token.clone(), Some(account_id.clone())).await {
        Ok(probe) => {
            let occupied: Vec<&InstallResourceProbe> =
                probe.resources.iter().filter(|r| r.occupied).collect();
            assert_occupied_wipe_allowed(&occupied, wipe_confirmation.as_deref())?;
            for r in &occupied {
                emit_log(
                    &app,
                    "rollback",
                    "info",
                    format!(
                        "Occupied {} `{}` — wipe confirmation accepted",
                        r.kind, r.name
                    ),
                );
            }
        }
        Err(e) => {
            if !wipe_confirmation_allows(
                wipe_confirmation.as_deref(),
                &[DEFAULT_SCRIPT, R2_BUCKET],
            ) {
                return Err(format!(
                    "Could not check existing data before rollback: {e}. Type DELETE ME or {DEFAULT_SCRIPT} to force wipe."
                ));
            }
            emit_log(
                &app,
                "rollback",
                "stderr",
                format!("Occupancy probe failed ({e}); proceeding after typed confirmation"),
            );
        }
    }

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
    resources.push(InstallResourceProbe::base(
        "worker",
        DEFAULT_SCRIPT,
        worker_present,
        "",
    ));
    let r2_present = find_r2_bucket(&client, R2_BUCKET).await?;
    let mut r2 = InstallResourceProbe::base("r2", R2_BUCKET, r2_present, "");
    if r2_present {
        let occ = count_r2_objects(&client, R2_BUCKET).await;
        r2.object_count = if occ.unknown { None } else { Some(occ.count) };
        r2.truncated = occ.truncated;
        r2.occupied = occ.occupied;
    }
    resources.push(r2);
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
        let mut d1 = InstallResourceProbe::base("d1", *name, !id.is_empty(), id.clone());
        if !id.is_empty() {
            let occ = count_d1_user_rows(&client, &id).await;
            d1.row_count = if occ.unknown { None } else { Some(occ.count) };
            d1.truncated = occ.truncated;
            d1.occupied = occ.occupied;
        }
        resources.push(d1);
    }
    Ok(InstallProbeResult {
        account_id,
        resources,
    })
}

#[derive(Default)]
struct InstallRunOptions {
    /// When set, reuse this AUTH_PEPPER instead of generating a new one (Worker update).
    existing_auth_pepper: Option<String>,
    /// When true, skip AUTH_PEPPER secret put (update keeps existing secret).
    skip_auth_pepper: bool,
    /// Worker script only — look up existing R2/D1, never create or wipe.
    worker_only: bool,
}

pub async fn auto_install_worker(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
    decisions: Vec<InstallDecision>,
    wipe_confirmation: Option<String>,
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
        wipe_confirmation.as_deref(),
    )
    .await;
    let _ = std::fs::remove_dir_all(&work_dir);
    result
}

/// Re-deploy the Worker from the latest hosted install ZIP (keeps AUTH_PEPPER + D1).
pub async fn update_installed_worker(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
) -> Result<AutoInstallResult, String> {
    reset_install_cancel();
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("A Cloudflare API token is required.".into());
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

    let saved = load_credentials()?.unwrap_or_default();
    let expected_url = saved.worker_url.clone();
    let script = if saved.worker_script_name.trim().is_empty() {
        DEFAULT_SCRIPT
    } else {
        saved.worker_script_name.trim()
    };
    let target = preview_worker_update_target(
        &api_token,
        &account_id,
        &expected_url,
        script,
    )
    .await?;
    assert_worker_update_target_matches(&target)?;

    let manifest = fetch_install_manifest().await?;
    let work_dir = stage_install_package(&app, &manifest).await?;
    if install_is_cancelled() {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(cancelled_error());
    }

    let mut run_opts = InstallRunOptions::default();
    run_opts.skip_auth_pepper = true;
    run_opts.worker_only = true;

    let result = auto_install_steps(
        &app,
        &work_dir,
        &api_token,
        &account_id,
        server_token.as_deref(),
        &InstallPlan::default(),
        &run_opts,
        read_staged_version(&work_dir),
        None,
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
    wipe_confirmation: Option<&str>,
) -> Result<AutoInstallResult, String> {
    check_cancelled()?;

    let client = CfClient {
        account_id: account_id.to_string(),
        api_token: api_token.to_string(),
    };

    let existing_d1 = list_d1_databases(&client).await.unwrap_or_default();
    let mut any_d1_reused = false;

    if run_opts.worker_only {
        let saved = load_credentials()?.unwrap_or_default();
        let script = if saved.worker_script_name.trim().is_empty() {
            DEFAULT_SCRIPT
        } else {
            saved.worker_script_name.trim()
        };
        let target = preview_worker_update_target(
            api_token,
            account_id,
            &saved.worker_url,
            script,
        )
        .await?;
        emit_log(
            app,
            "prepare",
            "info",
            format!("Saved Worker: {}", target.expected_worker_url),
        );
        emit_log(
            app,
            "prepare",
            "info",
            format!(
                "This Cloudflare account Worker: {}",
                target.oauth_worker_url
            ),
        );
        assert_worker_update_target_matches(&target)?;
        emit_log(
            app,
            "prepare",
            "info",
            "Worker-only update — looking up existing R2 and D1 (no create or wipe).",
        );
        if !find_r2_bucket(&client, R2_BUCKET).await? {
            return Err(format!(
                "R2 bucket {R2_BUCKET} is missing. Complete Setup install first."
            ));
        }
        emit_log(
            app,
            "r2",
            "info",
            format!("R2 bucket {R2_BUCKET} found — reusing"),
        );
    } else {
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
            let occ = count_r2_objects(&client, R2_BUCKET).await;
            if occ.occupied {
                assert_wipe_phrase(wipe_confirmation, &[R2_BUCKET])?;
            }
            emit_log(
                app,
                "r2",
                "info",
                format!("Reinstall — emptying and deleting R2 {R2_BUCKET}…"),
            );
            let _ = empty_r2_bucket(&client, R2_BUCKET).await;
            delete_r2_bucket(&client, R2_BUCKET).await?;
        }

        emit_log(
            app,
            "r2",
            "info",
            format!("Ensuring R2 bucket {R2_BUCKET}…"),
        );
        ensure_r2_bucket(&client, R2_BUCKET).await?;
        emit_log(
            app,
            "r2",
            "info",
            format!("R2 bucket {R2_BUCKET} ready"),
        );
    }
    check_cancelled()?;

    // D1: worker-only looks up; install creates or reuses. Schema is applied
    // after deploy via init-db (empty) or migrate-db (existing).
    let mut d1_ids: Vec<String> = Vec::with_capacity(D1_DATABASES.len());
    for (_binding, db_name) in D1_DATABASES {
        let db_id = if run_opts.worker_only {
            match existing_d1.iter().find(|(n, _)| n == db_name) {
                Some((_, id)) => {
                    any_d1_reused = true;
                    emit_log(
                        app,
                        "d1",
                        "info",
                        format!("D1 {db_name} found — reusing (id {id})"),
                    );
                    id.clone()
                }
                None => {
                    return Err(format!(
                        "D1 {db_name} is missing. Complete Setup install first."
                    ));
                }
            }
        } else if plan.should_reinstall_d1(db_name) {
            if let Some((_, id)) = existing_d1.iter().find(|(n, _)| n == db_name) {
                let occ = count_d1_user_rows(&client, id).await;
                if occ.occupied {
                    assert_wipe_phrase(wipe_confirmation, &[db_name])?;
                }
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
            any_d1_reused = true;
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
            format!("D1 {db_name} ready (id {db_id}) — schema via Worker init-db or migrate-db"),
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
                     script upload did not attach RELAYBASE_DB / LOGS / MAIL.",
                    D1_DATABASES.len()
                ));
            }
            let email_bound = bindings.iter().any(|(kind, name)| {
                kind == "send_email" && name == "EMAIL"
            });
            if !email_bound {
                emit_log(
                    app,
                    "deploy",
                    "info",
                    "send_email:EMAIL binding was not reported after upload. \
                     Sending falls back to the CF_API_TOKEN REST API until the next deploy.",
                );
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

    let access = crate::owner_session::current_access_token();
    let auth_pepper = if run_opts.skip_auth_pepper {
        String::new()
    } else if let Some(existing) = run_opts.existing_auth_pepper.as_ref() {
        existing.clone()
    } else {
        generate_auth_pepper()
    };
    if !run_opts.skip_auth_pepper {
        put_worker_secret(&client, DEFAULT_SCRIPT, "AUTH_PEPPER", &auth_pepper).await?;
        emit_log(app, "secret", "info", "AUTH_PEPPER secret set");
    } else {
        emit_log(
            app,
            "secret",
            "info",
            "AUTH_PEPPER unchanged — reusing existing secret",
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

    // Schema: empty D1s use init-db. Reused D1s and worker-only updates use
    // migrate-db (pending only — never wipe).
    let use_migrate = run_opts.worker_only || any_d1_reused;
    let pepper = if auth_pepper.is_empty() {
        None
    } else {
        Some(auth_pepper.as_str())
    };
    let init = if use_migrate {
        migrate_worker_db_with_retry(app, &worker_url, pepper, access.as_deref()).await
    } else {
        init_worker_db_with_retry(app, &worker_url, pepper, access.as_deref()).await
    };
    let step = if use_migrate { "migrate-db" } else { "init-db" };
    let (db_already_initialized, db_applied) = match init {
        Ok(r) => {
            emit_log(
                app,
                step,
                "info",
                if use_migrate {
                    if r.applied.is_empty() {
                        "D1 schema up to date — existing data kept".to_string()
                    } else {
                        format!(
                            "D1 pending migrations applied ({})",
                            r.applied.len()
                        )
                    }
                } else {
                    format!("D1 schema initialized ({} migrations applied)", r.applied.len())
                },
            );
            (use_migrate || r.already_initialized, r.applied)
        }
        Err(e) => {
            emit_log(
                app,
                step,
                "stderr",
                format!("Worker {step} call failed: {e}"),
            );
            return Err(explain_init_db_failure(&e));
        }
    };

    let worker_version = fetch_worker_version(&worker_url)
        .await
        .or(staged_version)
        .unwrap_or_else(|| "unknown".to_string());

    Ok(AutoInstallResult {
        worker_url,
        worker_script_name: DEFAULT_SCRIPT.to_string(),
        auth_pepper,
        admin_token: String::new(),
        r2_bucket: R2_BUCKET.to_string(),
        account_id: account_id.to_string(),
        d1_logs_id: d1_ids.get(0).cloned().unwrap_or_default(),
        d1_mail_id: d1_ids.get(1).cloned().unwrap_or_default(),
        d1_db_id: d1_ids.get(2).cloned().unwrap_or_default(),
        db_already_initialized,
        db_applied,
        worker_version,
    })
}

/// Result from the Worker's POST /console/init-db or /console/migrate-db.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitDbResult {
    pub ok: bool,
    #[serde(default)]
    pub already_initialized: bool,
    pub applied: Vec<String>,
    #[serde(default)]
    pub skipped: Vec<String>,
    #[serde(default)]
    pub cleared: bool,
}

fn is_transient_schema_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("1042")
        || lower.contains("404")
        || lower.contains("1101")
        || lower.contains("1104")
        || lower.contains("not found")
        || lower.contains("401")
        || lower.contains("unauthorized")
}

async fn init_worker_db_with_retry(
    app: &AppHandle,
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    const ATTEMPTS: u32 = 4;
    let mut last = String::new();
    for attempt in 1..=ATTEMPTS {
        match init_worker_db(worker_url, pepper, access_token).await {
            Ok(r) => return Ok(r),
            Err(e) => {
                last = e;
                if attempt == ATTEMPTS || !is_transient_schema_error(&last) {
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

async fn migrate_worker_db_with_retry(
    app: &AppHandle,
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    const ATTEMPTS: u32 = 4;
    let mut last = String::new();
    for attempt in 1..=ATTEMPTS {
        match migrate_worker_db(worker_url, pepper, access_token).await {
            Ok(r) => return Ok(r),
            Err(e) => {
                last = e;
                if attempt == ATTEMPTS || !is_transient_schema_error(&last) {
                    break;
                }
                emit_log(
                    app,
                    "migrate-db",
                    "info",
                    format!("migrate-db not ready yet (attempt {attempt}/{ATTEMPTS}) — retrying…"),
                );
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }
    Err(last)
}

async fn post_schema_endpoint(
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
    path: &str,
    step: &str,
) -> Result<InitDbResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is empty".into());
    }
    let url = format!("{base}{path}");
    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({}));
    if let Some(token) = access_token.filter(|s| !s.trim().is_empty()) {
        req = req.header("Authorization", format!("Bearer {}", token.trim()));
    } else if let Some(p) = pepper.filter(|s| !s.trim().is_empty()) {
        req = req.header("X-Auth-Pepper", p.trim());
    } else {
        return Err(format!("{step} requires an owner session or AUTH_PEPPER"));
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("{step} request failed: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format_worker_http_error(step, status, &text));
    }
    res.json::<InitDbResult>()
        .await
        .map_err(|e| format!("{step} response parse failed: {e}"))
}

/// Empty D1 only. Fails with 409 if product tables already exist.
pub async fn init_worker_db(
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    post_schema_endpoint(worker_url, pepper, access_token, "/console/init-db", "init-db").await
}

/// Pending migrations only. Never drops tables.
pub async fn migrate_worker_db(
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    post_schema_endpoint(worker_url, pepper, access_token, "/console/migrate-db", "migrate-db").await
}

/// Merge an auto-install result into stored credentials (preserves
/// Relaybase account + CF account id if already present).
pub fn merge_into_credentials(
    existing: &StoredCredentials,
    result: &AutoInstallResult,
    account_id: Option<String>,
) -> StoredCredentials {
    let mut next = existing.clone();
    next.account_id = account_id
        .filter(|a| !a.trim().is_empty())
        .or_else(|| (!result.account_id.is_empty()).then(|| result.account_id.clone()))
        .unwrap_or_else(|| existing.account_id.clone());
    next.worker_url = result.worker_url.clone();
    next.admin_token.clear();
    next.worker_script_name = result.worker_script_name.clone();
    if !result.worker_version.trim().is_empty() {
        next.worker_version = result.worker_version.clone();
    }
    next
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

#[cfg(test)]
mod wipe_phrase_tests {
    use super::{wipe_confirmation_allows, WIPE_PHRASE_DELETE_ME, DEFAULT_SCRIPT};

    #[test]
    fn delete_me_allows_any_resource() {
        assert!(wipe_confirmation_allows(
            Some(WIPE_PHRASE_DELETE_ME),
            &["relaybase-mailbox"]
        ));
    }

    #[test]
    fn project_name_allows() {
        assert!(wipe_confirmation_allows(
            Some(DEFAULT_SCRIPT),
            &["relaybase-mailbox"]
        ));
    }

    #[test]
    fn matching_resource_name_allows() {
        assert!(wipe_confirmation_allows(
            Some("relaybase-mailbox"),
            &["relaybase-mailbox"]
        ));
    }

    #[test]
    fn empty_or_wrong_phrase_refuses() {
        assert!(!wipe_confirmation_allows(None, &["relaybase-mailbox"]));
        assert!(!wipe_confirmation_allows(Some(""), &["relaybase-mailbox"]));
        assert!(!wipe_confirmation_allows(
            Some("delete me"),
            &["relaybase-mailbox"]
        ));
        assert!(!wipe_confirmation_allows(
            Some("relaybase-db"),
            &["relaybase-mailbox"]
        ));
    }
}

#[cfg(test)]
mod worker_url_match_tests {
    use super::{worker_url_host, worker_urls_match};

    #[test]
    fn hosts_match_ignore_scheme_slash_case() {
        assert!(worker_urls_match(
            "https://relaybase-api.sf-parkinglot.workers.dev/",
            "HTTPS://relaybase-api.sf-parkinglot.workers.dev"
        ));
        assert_eq!(
            worker_url_host("https://relaybase-api.sf-parkinglot.workers.dev/foo"),
            Some("relaybase-api.sf-parkinglot.workers.dev".into())
        );
    }

    #[test]
    fn different_subdomain_does_not_match() {
        assert!(!worker_urls_match(
            "https://relaybase-api.sf-parkinglot.workers.dev",
            "https://relaybase-api.other-account.workers.dev"
        ));
    }

    #[test]
    fn custom_domain_does_not_match_workers_dev() {
        assert!(!worker_urls_match(
            "https://mail.example.com",
            "https://relaybase-api.sf-parkinglot.workers.dev"
        ));
    }
}

#[cfg(test)]
mod worker_error_tests {
    use super::{extract_cf_error_code, format_worker_http_error, worker_js_is_current};

    #[test]
    fn current_js_has_d1_bound() {
        assert!(worker_js_is_current(
            r#"return { d1Bound: { app: true }, schemaMigrate: "reconcile-v1" }"#
        ));
        assert!(!worker_js_is_current(r#"return { d1Bound: { app: true } }"#));
        assert!(!worker_js_is_current(r#"export default { fetch() {} }"#));
    }

    #[test]
    fn parses_plain_error_code() {
        assert_eq!(
            extract_cf_error_code("Internal Server Error: error code: 1104"),
            Some(1104)
        );
        assert_eq!(extract_cf_error_code(r#"{"code":1101,"message":"x"}"#), Some(1101));
    }

    #[test]
    fn formats_1104_with_hint() {
        let msg = format_worker_http_error(
            "init-db",
            500,
            "Internal Server Error\nerror code: 1104",
        );
        assert!(msg.contains("1104"), "{msg}");
        assert!(msg.contains("not a Relaybase version"), "{msg}");
    }
}
