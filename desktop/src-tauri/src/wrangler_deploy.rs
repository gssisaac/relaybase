use crate::cloudflare::{ensure_d1_database, ensure_kv_namespace, ensure_r2_bucket, CfClient};
use crate::node_runtime::{build_wrangler_command, detect_node, path_with_node_prepended, NodeInfo};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerManifest {
    pub worker_version: String,
    pub product: String,
    pub script_name: String,
    pub required_migrations: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployLogLine {
    pub step: String,
    pub stream: String,
    pub line: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployStatus {
    pub step: String,
    pub state: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeployOpts {
    pub enable_d1_logs: bool,
    pub rotate_admin_token: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployResult {
    pub worker_url: String,
    pub worker_script_name: String,
    pub admin_token: String,
    pub worker_version: String,
    pub kv_namespace_id: String,
    pub r2_bucket: String,
    pub d1_database_id: Option<String>,
    pub migrations_applied: Vec<String>,
    pub deployed: bool,
}

const KV_TITLE: &str = "relaybase-app";
const R2_NAME: &str = "relaybase-inbound";
const D1_NAME: &str = "relaybase-logs";
const SCRIPT_NAME: &str = "relaybase-api";
const RESOURCE_NAME: &str = "relaybase-worker-install.zip";
const INSTALL_DIR_NAME: &str = "worker-install";

fn relaybase_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not resolve home directory".to_string())?;
    Ok(home.join(".relaybase"))
}
fn install_root() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(INSTALL_DIR_NAME))
}
fn logs_dir() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join("logs"))
}
fn bundled_zip_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Could not resolve resource dir: {e}"))?;
    Ok(resource.join(RESOURCE_NAME))
}

pub fn read_bundled_manifest(app: &AppHandle) -> Result<WorkerManifest, String> {
    let zip_path = bundled_zip_path(app)?;
    // `unzip -p` streams a single entry to stdout without extracting.
    let out = StdCommand::new("unzip")
        .arg("-p")
        .arg(&zip_path)
        .arg("relaybase-worker-install/worker-manifest.json")
        .output()
        .map_err(|e| format!("Could not run `unzip` to read manifest: {e}. Install unzip on PATH."))?;
    if !out.status.success() {
        return Err(format!(
            "Could not read worker-manifest.json from bundled ZIP (unzip exit {}). Run `pnpm pack:worker-install` and rebuild the desktop app.",
            out.status.code().map(|c| c.to_string()).unwrap_or_else(|| "signal".into())
        ));
    }
    let manifest: WorkerManifest =
        serde_json::from_slice(&out.stdout).map_err(|e| format!("Invalid worker-manifest.json: {e}"))?;
    Ok(manifest)
}

fn extract_install_zip(app: &AppHandle) -> Result<PathBuf, String> {
    let zip_path = bundled_zip_path(app)?;
    let root = install_root()?;
    // Wipe a previous extraction so stale files do not linger.
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).map_err(|e| format!("Could not create {}: {e}", root.display()))?;
    let status = StdCommand::new("unzip")
        .arg("-o")
        .arg(&zip_path)
        .arg("-d")
        .arg(&root)
        .status()
        .map_err(|e| format!("Could not run `unzip` to extract install ZIP: {e}. Install unzip on PATH."))?;
    if !status.success() {
        return Err(format!(
            "unzip failed (exit {}). Run `pnpm pack:worker-install` and rebuild the desktop app.",
            status.code().map(|c| c.to_string()).unwrap_or_else(|| "signal".into())
        ));
    }
    Ok(root.join("relaybase-worker-install"))
}

fn emit_log(app: &AppHandle, step: &str, stream: &str, line: &str) {
    let _ = app.emit("worker-deploy:log", DeployLogLine {
        step: step.to_string(), stream: stream.to_string(), line: line.to_string(),
    });
}
fn emit_status(app: &AppHandle, step: &str, state: &str, message: &str) {
    let _ = app.emit("worker-deploy:status", DeployStatus {
        step: step.to_string(), state: state.to_string(), message: message.to_string(),
    });
}
fn log_file_path() -> Result<PathBuf, String> {
    let dir = logs_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create logs dir: {e}"))?;
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    Ok(dir.join(format!("worker-deploy-{secs}.log")))
}

async fn stream_child(app: &AppHandle, step: &str, child: &mut tokio::process::Child, log_path: &Path) -> Result<String, String> {
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    let app_c1 = app.clone(); let s1 = step.to_string();
    let stdout_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        let mut buf = String::new();
        while let Ok(Some(l)) = lines.next_line().await {
            buf.push_str(&l);
            buf.push('\n');
            emit_log(&app_c1, &s1, "stdout", &l);
        }
        buf
    });

    let app_c2 = app.clone(); let s2 = step.to_string();
    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        let mut buf = String::new();
        while let Ok(Some(l)) = lines.next_line().await {
            buf.push_str(&l);
            buf.push('\n');
            emit_log(&app_c2, &s2, "stderr", &l);
        }
        buf
    });

    let status = child.wait().await.map_err(|e| format!("Process wait failed: {e}"))?;
    let stdout_buf = stdout_task.await.unwrap_or_default();
    let stderr_buf = stderr_task.await.unwrap_or_default();
    let combined = format!("{stdout_buf}{stderr_buf}");
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "=== {step} ===\n{combined}");
    }
    if !status.success() {
        return Err(format!("Step `{step}` failed (exit {}). See the log panel for details.", status.code().map(|c| c.to_string()).unwrap_or_else(|| "signal".into())));
    }
    Ok(combined)
}

async fn run_streaming(app: &AppHandle, step: &str, mut cmd: Command, stdin: Option<&str>, log_path: &Path) -> Result<String, String> {
    cmd.stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).kill_on_drop(true);
    if stdin.is_some() { cmd.stdin(std::process::Stdio::piped()); } else { cmd.stdin(std::process::Stdio::null()); }
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {e}"))?;
    if let Some(input) = stdin {
        if let Some(mut stdin_h) = child.stdin.take() {
            stdin_h.write_all(input.as_bytes()).await.map_err(|e| format!("Failed to write stdin: {e}"))?;
            drop(stdin_h);
        }
    }
    stream_child(app, step, &mut child, log_path).await
}

fn generate_admin_token() -> String { format!("rb_admin_{}", uuid::Uuid::new_v4()) }

fn patch_wrangler_toml(install_dir: &Path, kv_id: &str, enable_d1: bool, d1_id: Option<&str>) -> Result<(), String> {
    let toml_path = install_dir.join("wrangler.toml");
    let original = fs::read_to_string(&toml_path).map_err(|e| format!("Could not read wrangler.toml: {e}"))?;
    let mut out = original.replace("REPLACE_WITH_relaybase-app_ID", kv_id);
    if enable_d1 {
        if let Some(id) = d1_id {
            let d1_block = format!("[[d1_databases]]\nbinding = \"RELAYBASE_LOGS\"\ndatabase_name = \"{D1_NAME}\"\ndatabase_id = \"{id}\"\nmigrations_dir = \"migrations-logs\"\n");
            if let Some(idx) = out.find("# Optional — hosted-only product ops logs") { out.truncate(idx); out.push_str(&d1_block); } else { out.push('\n'); out.push_str(&d1_block); }
        }
    }
    fs::write(&toml_path, out).map_err(|e| format!("Could not write wrangler.toml: {e}"))?;
    Ok(())
}

fn extract_worker_url(output: &str) -> Option<String> {
    // Find the first https://...workers.dev URL in wrangler deploy output.
    let needle = "https://";
    let target = ".workers.dev";
    let mut start = 0;
    while let Some(idx) = output[start..].find(needle) {
        let abs = start + idx;
        let rest = &output[abs..];
        if let Some(end) = rest.find(target) {
            let candidate = &rest[..end + target.len()];
            // Trim trailing punctuation that wrangler may append.
            let trimmed = candidate.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '/' && c != '.' && c != '-' && c != '_');
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        start = abs + needle.len();
    }
    None
}

fn require_node() -> Result<NodeInfo, String> {
    detect_node().ok_or_else(|| "Node.js was not found. Install Node.js 20+ (e.g. `brew install node` on macOS, or from nodejs.org), then retry.".to_string())
}
fn require_credentials() -> Result<(String, String), String> {
    let creds = crate::secrets::load_credentials()?.ok_or_else(|| "Connect Cloudflare first — enter your Account ID and API token in Settings.".to_string())?;
    if creds.account_id.trim().is_empty() || creds.api_token.trim().is_empty() {
        return Err("Cloudflare Account ID and API token are required. Add them in Settings first.".into());
    }
    Ok((creds.account_id.trim().to_string(), creds.api_token.trim().to_string()))
}
fn wrangler_env(node: &NodeInfo, api_token: &str) -> Vec<(String, String)> {
    vec![
        ("PATH".into(), path_with_node_prepended(node)),
        ("CLOUDFLARE_API_TOKEN".into(), api_token.to_string()),
        ("CI".into(), "true".into()),
        ("WRANGLER_SEND_METRICS".into(), "false".into()),
        ("HOME".into(), dirs::home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default()),
    ]
}

#[tauri::command]
pub async fn deploy_routing_worker_v2(
    app: AppHandle,
    opts: Option<DeployOpts>,
) -> Result<DeployResult, String> {
    let opts = opts.unwrap_or_default();
    let log_path = log_file_path()?;
    emit_status(&app, "start", "running", "Preparing install package…");
    let node = require_node()?;
    let (account_id, api_token) = require_credentials()?;

    emit_status(&app, "extract", "running", "Extracting bundled Worker ZIP…");
    let install_dir = extract_install_zip(&app)?;
    emit_log(&app, "extract", "stdout", &format!("Extracted to {}", install_dir.display()));
    let manifest = read_bundled_manifest(&app)?;
    emit_log(&app, "extract", "stdout", &format!("Bundled worker version: {}", manifest.worker_version));

    emit_status(&app, "npm-install", "running", "Running npm install (one-time, may take a minute)…");
    let npm_bin = node.bin_dir().join("npm");
    let mut npm_cmd = Command::new(npm_bin);
    npm_cmd.arg("install").arg("--no-audit").arg("--no-fund").current_dir(&install_dir).env("PATH", path_with_node_prepended(&node));
    run_streaming(&app, "npm-install", npm_cmd, None, &log_path).await?;

    let cf = CfClient { account_id: account_id.clone(), api_token: api_token.clone() };
    emit_status(&app, "provision", "running", "Ensuring KV namespace + R2 bucket…");
    let kv_id = ensure_kv_namespace(&cf, KV_TITLE).await?;
    ensure_r2_bucket(&cf, R2_NAME).await?;
    let d1_id = if opts.enable_d1_logs { Some(ensure_d1_database(&cf, D1_NAME).await?) } else { None };
    emit_log(&app, "provision", "stdout", &format!("KV id: {kv_id}; R2 bucket: {R2_NAME}; D1: {}", d1_id.as_deref().unwrap_or("skipped")));

    patch_wrangler_toml(&install_dir, &kv_id, opts.enable_d1_logs, d1_id.as_deref())?;
    emit_log(&app, "provision", "stdout", "Patched wrangler.toml with resource ids");

    emit_status(&app, "deploy", "running", "Running wrangler deploy…");
    let env = wrangler_env(&node, &api_token);
    let mut deploy_cmd = build_wrangler_command(&["deploy"], &node);
    deploy_cmd.current_dir(&install_dir);
    for (k, v) in &env { deploy_cmd.env(k, v); }
    let deploy_output = run_streaming(&app, "deploy", deploy_cmd, None, &log_path).await?;
    let worker_url = extract_worker_url(&deploy_output)
        .ok_or_else(|| "Could not find a *.workers.dev URL in wrangler deploy output. Check the log panel.".to_string())?;
    emit_log(&app, "deploy", "stdout", &format!("Worker URL: {worker_url}"));

    let stored = crate::secrets::load_credentials()?.unwrap_or_default();
    let admin_token = if opts.rotate_admin_token || stored.admin_token.trim().is_empty() {
        generate_admin_token()
    } else {
        stored.admin_token.trim().to_string()
    };
    emit_status(&app, "secret", "running", "Setting ADMIN_TOKEN secret…");
    let mut secret_cmd = build_wrangler_command(&["secret", "put", "ADMIN_TOKEN"], &node);
    secret_cmd.current_dir(&install_dir);
    for (k, v) in &env { secret_cmd.env(k, v); }
    run_streaming(&app, "secret", secret_cmd, Some(&admin_token), &log_path).await?;

    let mut migrations_applied: Vec<String> = Vec::new();
    if opts.enable_d1_logs {
        emit_status(&app, "migrate", "running", "Applying D1 migrations…");
        let mut mig_cmd = build_wrangler_command(&["d1", "migrations", "apply", D1_NAME, "--remote"], &node);
        mig_cmd.current_dir(&install_dir);
        for (k, v) in &env { mig_cmd.env(k, v); }
        run_streaming(&app, "migrate", mig_cmd, None, &log_path).await?;
        migrations_applied.push("0001_ops_logs".into());
    }

    // Record applied migrations in KV so the worker can report them via /admin/version.
    let meta = serde_json::json!({ "applied": migrations_applied }).to_string();
    let mut kv_cmd = build_wrangler_command(
        &["kv", "key", "put", "srv:meta:migrations", &meta, "--namespace-id", &kv_id, "--remote"],
        &node,
    );
    kv_cmd.current_dir(&install_dir);
    for (k, v) in &env { kv_cmd.env(k, v); }
    match run_streaming(&app, "record", kv_cmd, None, &log_path).await {
        Ok(_) => emit_log(&app, "record", "stdout", "Recorded srv:meta:migrations"),
        Err(e) => emit_log(&app, "record", "stderr", &format!("Failed to record migrations meta (non-fatal): {e}")),
    }

    emit_status(&app, "verify", "running", "Verifying Worker /admin/version…");
    let verify = verify_worker_version(&worker_url, &admin_token).await;
    let (verified_version, ok) = match verify {
        Ok(v) => (Some(v.worker_version.clone()), true),
        Err(e) => { emit_log(&app, "verify", "stderr", &e); (None, false) }
    };
    emit_log(&app, "verify", "stdout", &format!("Verified: ok={ok}, version={}", verified_version.as_deref().unwrap_or("?")));

    // Persist worker_url + admin_token + kv_namespace_id so the app connects
    // and can run KV commands / health checks later.
    let mut next = crate::secrets::load_credentials()?.unwrap_or_default();
    next.worker_url = worker_url.clone();
    next.admin_token = admin_token.clone();
    next.worker_script_name = SCRIPT_NAME.to_string();
    next.kv_namespace_id = kv_id.clone();
    crate::secrets::save_credentials(&next)?;

    emit_status(&app, "done", "ok", "Deploy complete");
    Ok(DeployResult {
        worker_url,
        worker_script_name: SCRIPT_NAME.to_string(),
        admin_token,
        worker_version: manifest.worker_version,
        kv_namespace_id: kv_id,
        r2_bucket: R2_NAME.to_string(),
        d1_database_id: d1_id,
        migrations_applied,
        deployed: true,
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerVersionResponse {
    ok: bool,
    worker_version: String,
}

/// Probe the deployed Worker's /admin/version. Returns the parsed version payload.
pub async fn verify_worker_version(
    worker_url: &str,
    admin_token: &str,
) -> Result<WorkerVersionResponse, String> {
    let base = worker_url.trim_end_matches('/');
    let url = format!("{base}/admin/version");
    let http = reqwest::Client::new();
    let res = http
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token.trim()))
        .send()
        .await
        .map_err(|e| format!("Could not reach Worker /admin/version: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("/admin/version returned HTTP {}", res.status()));
    }
    let value: serde_json::Value = res.json().await.map_err(|e| format!("Bad JSON: {e}"))?;
    let resp: WorkerVersionResponse = serde_json::from_value(value).map_err(|e| format!("Bad payload: {e}"))?;
    if !resp.ok {
        return Err("Worker reported not ok".into());
    }
    Ok(resp)
}

/// Read-only KV health check: list srv:config:* and srv:key:* prefixes via wrangler
/// and warn if missing. Best-effort — failures are logged but not fatal.
#[tauri::command]
pub async fn kv_health_check(app: AppHandle) -> Result<serde_json::Value, String> {
    let node = require_node()?;
    let (_account_id, api_token) = require_credentials()?;
    let creds = crate::secrets::load_credentials()?.unwrap_or_default();
    let kv_id = creds.kv_namespace_id.trim();
    if kv_id.is_empty() {
        return Err("No KV namespace id stored. Deploy the Worker first.".into());
    }
    let log_path = log_file_path()?;
    let env = wrangler_env(&node, &api_token);
    let mut cmd = build_wrangler_command(&["kv", "key", "list", "--namespace-id", kv_id, "--remote"], &node);
    for (k, v) in &env { cmd.env(k, v); }
    let out = run_streaming(&app, "kv-check", cmd, None, &log_path).await?;
    let has_config = out.contains("srv:config");
    let has_keys = out.contains("srv:key");
    Ok(serde_json::json!({
        "kvNamespaceId": kv_id,
        "srvConfigPresent": has_config,
        "srvKeyPresent": has_keys,
        "ok": has_config && has_keys,
    }))
}

/// Read the bundled worker version (for the "update available" check).
#[tauri::command]
pub fn get_bundled_worker_version(app: AppHandle) -> Result<String, String> {
    Ok(read_bundled_manifest(&app)?.worker_version)
}
