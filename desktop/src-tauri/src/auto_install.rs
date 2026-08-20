//! Background auto-install of the Relaybase routing Worker into the user's
//! Cloudflare account using the customer-install template + `wrangler`.
//!
//! Flow (each step streams `install-log` events to the frontend):
//!   1. Resolve the customer-install template directory (wrangler.toml + src).
//!   2. `wrangler r2 bucket create relaybase-mailbox`.
//!   3. Create D1 databases, patch ids, apply migrations.
//!   4. Generate an admin token; `wrangler secret put ADMIN_TOKEN` (stdin).
//!   5. `wrangler deploy` → parse the `*.workers.dev` URL.
//!   6. Return { workerUrl, adminToken, workerScriptName }.
//!
//! The user's Cloudflare API token is passed via the `CLOUDFLARE_API_TOKEN`
//! env var to each wrangler invocation. It is never sent to the Relaybase
//! console or product Worker.

use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Notify;

use crate::cloudflare::{
    delete_d1_database, delete_r2_bucket, delete_worker_script, empty_r2_bucket, list_d1_databases,
    resolve_account_id, CfClient,
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

/// D1 databases created during install. Each entry is (binding, db_name,
/// migrations_dir, placeholder in wrangler.toml).
const D1_DATABASES: &[(&str, &str, &str, &str)] = &[
    ("RELAYBASE_LOGS", "relaybase-logs", "migrations-logs", "REPLACE_WITH_relaybase-logs_ID"),
    ("RELAYBASE_INBOX_INDEX", "relaybase-inbox-index", "migrations-inbox", "REPLACE_WITH_relaybase-inbox-index_ID"),
    ("RELAYBASE_DB", "relaybase-db", "migrations-app", "REPLACE_WITH_relaybase-db_ID"),
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
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    step: String,
    level: String,
    line: String,
}

/// Resolve the customer-install template directory.
///
/// Order:
///   1. `RELAYBASE_INSTALL_TEMPLATE_DIR` env var (explicit override).
///   2. `<resource_dir>/customer-install` (bundled in packaged builds).
///   3. `<repo>/server/customer-install` (dev / `tauri dev` from a checkout).
fn resolve_template_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = env::var("RELAYBASE_INSTALL_TEMPLATE_DIR") {
        let p = PathBuf::from(dir);
        if p.join("wrangler.toml").is_file() {
            return Ok(p);
        }
        return Err(format!(
            "RELAYBASE_INSTALL_TEMPLATE_DIR points to {p:?} but no wrangler.toml found there"
        ));
    }
    // Packaged builds: resources/customer-install (set by tauri.conf.json).
    if let Some(p) = resource_dir().map(|d| d.join("customer-install")) {
        if p.join("wrangler.toml").is_file() {
            return Ok(p);
        }
    }
    // Dev fallback: walk up from CWD to find server/customer-install.
    if let Some(p) = find_repo_template() {
        return Ok(p);
    }
    Err(
        "Could not locate the Relaybase install template (wrangler.toml). \
         Set RELAYBASE_INSTALL_TEMPLATE_DIR or bundle customer-install under resources."
            .into(),
    )
}

fn resource_dir() -> Option<PathBuf> {
    // tauri::path::resource_dir() is only available with an AppHandle at runtime;
    // for discovery here we approximate via the current executable's dir.
    let exe = env::current_exe().ok()?;
    let dir = exe.parent()?;
    // Typical layout: <install>/Relaybase + resources/ sibling.
    let candidates = [
        dir.join("resources").join("customer-install"),
        dir.parent()?.join("resources").join("customer-install"),
    ];
    for c in candidates {
        if c.join("wrangler.toml").is_file() {
            return Some(c.parent()?.join("customer-install"));
        }
    }
    None
}

fn find_repo_template() -> Option<PathBuf> {
    let mut cur = env::current_dir().ok()?;
    for _ in 0..8 {
        let candidate = cur.join("server").join("customer-install");
        if candidate.join("wrangler.toml").is_file() {
            return Some(candidate);
        }
        if !cur.pop() {
            break;
        }
    }
    None
}

/// Copy the template into a fresh temp working directory and return its path.
///
/// `server/customer-install` is wrangler.toml-only. When `src/index.ts` is
/// missing, pull Worker source, D1 migrations, and deps from `server/`.
fn stage_template(template: &Path) -> Result<PathBuf, String> {
    let tmp = std::env::temp_dir().join(format!("relaybase-install-{}", uuid::Uuid::new_v4()));
    copy_dir(template, &tmp)?;
    enrich_template(&tmp, template)?;
    Ok(tmp)
}

fn enrich_template(work_dir: &Path, template: &Path) -> Result<(), String> {
    if work_dir.join("src").join("index.ts").is_file() {
        return Ok(());
    }
    let server_root = template.parent().filter(|p| p.join("src").join("index.ts").is_file());
    let Some(server_root) = server_root else {
        return Err(
            "Install template is missing src/index.ts. Re-pack customer-install or run from a full checkout."
                .into(),
        );
    };
    copy_dir(&server_root.join("src"), &work_dir.join("src"))?;
    if server_root.join("db").is_dir() {
        copy_dir(&server_root.join("db"), &work_dir.join("db"))?;
    }
    for dir in ["migrations-app", "migrations-logs", "migrations-inbox"] {
        let src = server_root.join(dir);
        if src.is_dir() {
            copy_dir(&src, &work_dir.join(dir))?;
        }
    }
    for file in ["package.json", "tsconfig.json"] {
        let src = server_root.join(file);
        if src.is_file() {
            std::fs::copy(&src, work_dir.join(file))
                .map_err(|e| format!("copy {file}: {e}"))?;
        }
    }
    let nm = server_root.join("node_modules");
    if nm.is_dir() && !work_dir.join("node_modules").exists() {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&nm, work_dir.join("node_modules"))
                .map_err(|e| format!("symlink node_modules: {e}"))?;
        }
        #[cfg(not(unix))]
        {
            copy_dir(&nm, &work_dir.join("node_modules"))?;
        }
    }
    Ok(())
}

fn copy_dir(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| format!("mkdir {dst:?}: {e}"))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("read {src:?}: {e}"))? {
        let entry = entry.map_err(|e| format!("dir entry {src:?}: {e}"))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            std::fs::copy(&from, &to).map_err(|e| format!("copy {from:?}: {e}"))?;
        }
    }
    Ok(())
}

fn generate_admin_token() -> String {
    // 32 hex chars = 128 bits of entropy (two uuid v4s concatenated).
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// Patch a single D1 database id placeholder in the staged wrangler.toml.
fn patch_d1_id(work_dir: &Path, placeholder: &str, db_id: &str) -> Result<(), String> {
    let path = work_dir.join("wrangler.toml");
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("read wrangler.toml: {e}"))?;
    let next = raw.replace(placeholder, db_id);
    std::fs::write(&path, next).map_err(|e| format!("write wrangler.toml: {e}"))
}

/// Run a wrangler command in `work_dir`, streaming stdout+stderr lines as
/// `install-log` events. Returns the combined stdout (for parsing).
async fn run_wrangler(
    app: &AppHandle,
    step: &str,
    work_dir: &Path,
    args: &[&str],
    api_token: &str,
    stdin: Option<&[u8]>,
) -> Result<String, String> {
    let mut cmd = Command::new("npx");
    cmd.arg("--yes").arg("wrangler");
    cmd.args(args);
    cmd.current_dir(work_dir);
    cmd.env("CLOUDFLARE_API_TOKEN", api_token);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.stdin(Stdio::piped());
    cmd.kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Could not start wrangler (is Node/npx installed?): {e}. \
             Install Node.js 20+ and retry, or use the manual install path."
        )
    })?;

    if let Some(input) = stdin {
        if let Some(mut stdin_pipe) = child.stdin.take() {
            stdin_pipe.write_all(input).await.map_err(|e| format!("write stdin: {e}"))?;
            drop(stdin_pipe);
        }
    } else {
        // Drop stdin so the child doesn't wait for input.
        drop(child.stdin.take());
    }

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let mut stdout = BufReader::new(stdout);
    let mut stderr = BufReader::new(stderr);

    let mut stdout_buf = String::new();
    let mut stdout_line = String::new();
    let mut stderr_line = String::new();
    let mut stdout_done = false;
    let mut stderr_done = false;

    if install_is_cancelled() {
        let _ = child.kill().await;
        let _ = child.wait().await;
        return Err(cancelled_error());
    }

    loop {
        if stdout_done && stderr_done {
            break;
        }
        tokio::select! {
            _ = cancel_notify().notified() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err(cancelled_error());
            }
            n = stdout.read_line(&mut stdout_line), if !stdout_done => {
                match n {
                    Ok(0) => stdout_done = true,
                    Ok(_) => {
                        stdout_buf.push_str(&stdout_line);
                        let _ = app.emit(
                            "install-log",
                            LogEvent {
                                step: step.into(),
                                level: "stdout".into(),
                                line: stdout_line.trim_end().to_string(),
                            },
                        );
                        stdout_line.clear();
                    }
                    Err(e) => return Err(format!("read stdout: {e}")),
                }
            }
            n = stderr.read_line(&mut stderr_line), if !stderr_done => {
                match n {
                    Ok(0) => stderr_done = true,
                    Ok(_) => {
                        let _ = app.emit(
                            "install-log",
                            LogEvent {
                                step: step.into(),
                                level: "stderr".into(),
                                line: stderr_line.trim_end().to_string(),
                            },
                        );
                        stderr_line.clear();
                    }
                    Err(e) => return Err(format!("read stderr: {e}")),
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| format!("wait: {e}"))?;
    if install_is_cancelled() {
        return Err(cancelled_error());
    }
    if !status.success() {
        return Err(format!("wrangler {step} exited with status {status}"));
    }
    Ok(stdout_buf)
}

async fn ensure_node_modules(app: &AppHandle, work_dir: &Path) -> Result<(), String> {
    check_cancelled()?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "deps".into(),
            level: "info".into(),
            line: "Installing Worker dependencies…".into(),
        },
    );
    let mut cmd = Command::new("npm");
    cmd.args(["install", "--omit=dev", "--no-fund", "--no-audit"]);
    cmd.current_dir(work_dir);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    cmd.kill_on_drop(true);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not run npm install: {e}"))?;
    tokio::select! {
        _ = cancel_notify().notified() => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err(cancelled_error());
        }
        status = child.wait() => {
            let status = status.map_err(|e| format!("wait: {e}"))?;
            if install_is_cancelled() {
                return Err(cancelled_error());
            }
            if !status.success() {
                return Err(format!("npm install exited with status {status}"));
            }
        }
    }
    Ok(())
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
    let d1_wanted: Vec<&str> = D1_DATABASES.iter().map(|(_, name, _, _)| *name).collect();
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

/// Parse a wrangler resource id from CLI output (`id = ...` or JSON `"id"`).
fn parse_wrangler_id(output: &str) -> Option<String> {
    // wrangler prints: "id = <32 hex>" or a JSON-ish payload depending on version.
    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(idx) = trimmed.find("id =") {
            let rest = trimmed[idx + 4..].trim();
            if let Some(id) = rest.split_whitespace().next() {
                if id.len() >= 16 {
                    return Some(id.to_string());
                }
            }
        }
        if let Some(idx) = trimmed.find("\"id\"") {
            let rest = trimmed[idx + 4..].trim_start_matches([':', ' ', '"']);
            if let Some(id) = rest.split('"').next() {
                if id.len() >= 16 {
                    return Some(id.to_string());
                }
            }
        }
    }
    None
}

/// Parse the D1 database id from `wrangler d1 create` output.
/// wrangler prints: `database_id = "<uuid>"` or a JSON payload with `"uuid"`.
fn parse_d1_id(output: &str) -> Option<String> {
    for line in output.lines() {
        let trimmed = line.trim();
        // wrangler v4: `database_id = "<uuid>"`
        if let Some(idx) = trimmed.find("database_id =") {
            let rest = trimmed[idx + 13..].trim().trim_matches('"');
            if rest.len() >= 16 {
                return Some(rest.to_string());
            }
        }
        // JSON: `"uuid": "<id>"`
        if let Some(idx) = trimmed.find("\"uuid\"") {
            let rest = trimmed[idx + 6..].trim_start_matches([':', ' ', '"']);
            if let Some(id) = rest.split('"').next() {
                if id.len() >= 16 {
                    return Some(id.to_string());
                }
            }
        }
        // JSON: `"d1_database_id": "<id>"` or `"database_id": "<id>"`
        for key in ["\"d1_database_id\"", "\"database_id\""] {
            if let Some(idx) = trimmed.find(key) {
                let rest = trimmed[idx + key.len()..].trim_start_matches([':', ' ', '"']);
                if let Some(id) = rest.split('"').next() {
                    if id.len() >= 16 {
                        return Some(id.to_string());
                    }
                }
            }
        }
    }
    // Fallback: some wrangler versions print just `id = ...`
    parse_wrangler_id(output)
}

/// Find a D1 id by name in `wrangler d1 list --json` output.
fn parse_d1_id_from_list(output: &str, db_name: &str) -> Option<String> {
    let json_start = output.find(['[', '{'])?;
    let parsed: serde_json::Value = serde_json::from_str(&output[json_start..]).ok()?;
    let rows = parsed
        .as_array()
        .or_else(|| parsed.get("result").and_then(|v| v.as_array()))?;
    for row in rows {
        let name = row.get("name").and_then(|v| v.as_str());
        if name != Some(db_name) {
            continue;
        }
        for key in ["uuid", "id", "database_id"] {
            if let Some(id) = row.get(key).and_then(|v| v.as_str()) {
                if id.len() >= 16 {
                    return Some(id.to_string());
                }
            }
        }
    }
    None
}

/// Parse the deployed workers.dev URL from `wrangler deploy` output.
fn parse_worker_url(output: &str) -> Option<String> {
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.contains("workers.dev") {
            // Take the first https://*.workers.dev token on the line.
            if let Some(start) = trimmed.find("https://") {
                let rest = &trimmed[start..];
                if let Some(end) = rest.find(char::is_whitespace) {
                    return Some(rest[..end].trim_end_matches('.').to_string());
                }
                return Some(rest.trim_end_matches('.').to_string());
            }
        }
    }
    None
}

pub async fn auto_install_worker(
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

    let template = resolve_template_dir()?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "prepare".into(),
            level: "info".into(),
            line: format!("Using install template at {}", template.display()),
        },
    );

    let work_dir = stage_template(&template)?;
    if install_is_cancelled() {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(cancelled_error());
    }
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "prepare".into(),
            level: "info".into(),
            line: format!("Staged working copy at {}", work_dir.display()),
        },
    );

    let result = auto_install_steps(
        &app,
        &work_dir,
        &api_token,
        &account_id,
        server_token.as_deref(),
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

    // 1) R2 bucket (ignore "already exists" errors). KV is not created —
    //    product state lives in D1 + R2; ADMIN_TOKEN is a wrangler secret.
    let r2_result = run_wrangler(
        app,
        "r2",
        work_dir,
        &["r2", "bucket", "create", R2_BUCKET],
        api_token,
        None,
    )
    .await;
    match r2_result {
        Ok(_) => {
            check_cancelled()?;
        }
        Err(e) if is_cancelled_error(&e) => return Err(e),
        Err(e) => {
            let msg = e.to_string();
            if !msg.to_lowercase().contains("already exists") && !msg.to_lowercase().contains("exists")
            {
                return Err(msg);
            }
            let _ = app.emit(
                "install-log",
                LogEvent {
                    step: "r2".into(),
                    level: "info".into(),
                    line: format!("R2 bucket {R2_BUCKET} already exists — reusing"),
                },
            );
        }
    }

    // 2) D1 databases — create (or reuse), patch id into wrangler.toml, apply migrations.
    let mut d1_ids: Vec<String> = Vec::with_capacity(D1_DATABASES.len());
    for (_binding, db_name, migrations_dir, placeholder) in D1_DATABASES {
        let db_id = match run_wrangler(
            app,
            "d1-create",
            work_dir,
            &["d1", "create", db_name],
            api_token,
            None,
        )
        .await
        {
            Ok(create_out) => parse_d1_id(&create_out).ok_or_else(|| {
                format!("Could not parse D1 id for {db_name} from wrangler output:\n{create_out}")
            })?,
            Err(e) if is_cancelled_error(&e) => return Err(e),
            Err(e) => {
                let list_out = run_wrangler(
                    app,
                    "d1-list",
                    work_dir,
                    &["d1", "list", "--json"],
                    api_token,
                    None,
                )
                .await
                .map_err(|list_err| {
                    if is_cancelled_error(&list_err) {
                        list_err
                    } else {
                        e.clone()
                    }
                })?;
                parse_d1_id_from_list(&list_out, db_name).ok_or(e)?
            }
        };
        patch_d1_id(work_dir, placeholder, &db_id)?;
        check_cancelled()?;
        let _ = app.emit(
            "install-log",
            LogEvent {
                step: "d1".into(),
                level: "info".into(),
                line: format!("D1 {db_name} ready (id {db_id})"),
            },
        );

        // Apply migrations for this database.
        run_wrangler(
            app,
            "d1-migrate",
            work_dir,
            &[
                "d1",
                "migrations",
                "apply",
                "--remote",
                "--yes",
                &format!("--migrations-dir={migrations_dir}"),
                db_name,
            ],
            api_token,
            None,
        )
        .await?;
        let _ = app.emit(
            "install-log",
            LogEvent {
                step: "d1".into(),
                level: "info".into(),
                line: format!("D1 {db_name} migrations applied"),
            },
        );
        d1_ids.push(db_id);
    }

    // 3) Admin token + secret
    check_cancelled()?;
    let admin_token = generate_admin_token();
    run_wrangler(
        app,
        "secret",
        work_dir,
        &["secret", "put", "ADMIN_TOKEN"],
        api_token,
        Some(admin_token.as_bytes()),
    )
    .await?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "secret".into(),
            level: "info".into(),
            line: "ADMIN_TOKEN secret set".to_string(),
        },
    );

    // 3b) Cloudflare runtime secrets so the Worker can send mail. CF_ACCOUNT_ID
    //     is always pushed. CF_API_TOKEN is only pushed when the user supplied
    //     a server token with Email Sending Edit — pushing the install token
    //     here caused [10000] Authentication errors on send_raw.
    run_wrangler(
        app,
        "secret",
        work_dir,
        &["secret", "put", "CF_ACCOUNT_ID"],
        api_token,
        Some(account_id.as_bytes()),
    )
    .await?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "secret".into(),
            level: "info".into(),
            line: "CF_ACCOUNT_ID secret set".to_string(),
        },
    );

    if let Some(server) = server_token {
        run_wrangler(
            app,
            "secret",
            work_dir,
            &["secret", "put", "CF_API_TOKEN"],
            api_token,
            Some(server.as_bytes()),
        )
        .await?;
        let _ = app.emit(
            "install-log",
            LogEvent {
                step: "secret".into(),
                level: "info".into(),
                line: "CF_API_TOKEN secret set (server token)".to_string(),
            },
        );
    } else {
        let _ = app.emit(
            "install-log",
            LogEvent {
                step: "secret".into(),
                level: "info".into(),
                line: "CF_API_TOKEN skipped — set the server token (Email Sending Edit) in Settings to enable sending.".to_string(),
            },
        );
    }

    if !work_dir.join("node_modules").exists() {
        ensure_node_modules(app, work_dir).await?;
    }

    // 4) Deploy
    check_cancelled()?;
    let deploy_out = run_wrangler(
        app,
        "deploy",
        work_dir,
        &["deploy"],
        api_token,
        None,
    )
    .await?;
    let worker_url = parse_worker_url(&deploy_out).ok_or_else(|| {
        format!("Could not parse workers.dev URL from wrangler deploy output:\n{deploy_out}")
    })?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "deploy".into(),
            level: "info".into(),
            line: format!("Deployed at {worker_url}"),
        },
    );

    Ok(AutoInstallResult {
        worker_url,
        worker_script_name: DEFAULT_SCRIPT.to_string(),
        admin_token,
        r2_bucket: R2_BUCKET.to_string(),
        account_id: account_id.to_string(),
        d1_logs_id: d1_ids.get(0).cloned().unwrap_or_default(),
        d1_inbox_index_id: d1_ids.get(1).cloned().unwrap_or_default(),
        d1_db_id: d1_ids.get(2).cloned().unwrap_or_default(),
    })
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

/// Run `wrangler secret put CF_API_TOKEN` against an already-deployed Worker
/// using the install token for wrangler auth and the server token as the
/// secret value. Returns the ISO timestamp of the push. Used by the Settings
/// "push server token" action after install.
pub async fn push_cf_api_token_secret(
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

    // Stage a minimal work dir so wrangler can resolve the script by name.
    // wrangler secret put operates on the script in the current account,
    // so we only need a wrangler.toml pointing at the existing script.
    let work_dir = std::env::temp_dir().join(format!("relaybase-secret-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let wrangler_toml = format!(
        "name = \"{script_name}\"\ncompatibility_date = \"2024-09-23\"\n"
    );
    std::fs::write(work_dir.join("wrangler.toml"), wrangler_toml)
        .map_err(|e| format!("Failed to write wrangler.toml: {e}"))?;

    // Reuse run_wrangler without an AppHandle by inlining a minimal version.
    let mut cmd = Command::new("npx");
    cmd.arg("--yes").arg("wrangler");
    cmd.args(["secret", "put", "CF_API_TOKEN"]);
    cmd.current_dir(&work_dir);
    cmd.env("CLOUDFLARE_API_TOKEN", install_token);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.stdin(Stdio::piped());
    cmd.kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Could not start wrangler (is Node/npx installed?): {e}. \
             Install Node.js 20+ and retry."
        )
    })?;

    if let Some(mut stdin) = child.stdin.take() {
        // Write the server token as the secret value, then close stdin.
        let _ = stdin.write_all(server_token.as_bytes()).await;
        drop(stdin);
    } else {
        drop(child.stdin.take());
    }

    let status = child.wait().await.map_err(|e| format!("wait: {e}"))?;
    let _ = std::fs::remove_dir_all(&work_dir);
    if !status.success() {
        return Err(format!("wrangler secret put CF_API_TOKEN exited with status {status}"));
    }

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
