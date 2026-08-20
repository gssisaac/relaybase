//! Background auto-install of the Relaybase routing Worker into the user's
//! Cloudflare account using the customer-install template + `wrangler`.
//!
//! Flow (each step streams `install-log` events to the frontend):
//!   1. Resolve the customer-install template directory (wrangler.toml + src).
//!   2. `wrangler kv namespace create relaybase-app` → parse id, patch wrangler.toml.
//!   3. `wrangler r2 bucket create relaybase-mailbox`.
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

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

use crate::cloudflare::resolve_account_id;
use crate::secrets::StoredCredentials;
use crate::worker::DEFAULT_SCRIPT;

const KV_NAMESPACE: &str = "relaybase-app";
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
    pub kv_namespace_id: String,
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
fn stage_template(template: &Path) -> Result<PathBuf, String> {
    let tmp = std::env::temp_dir().join(format!("relaybase-install-{}", uuid::Uuid::new_v4()));
    copy_dir(template, &tmp)?;
    Ok(tmp)
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

/// Patch the staged wrangler.toml: replace the KV id placeholder with the
/// real namespace id returned by `wrangler kv namespace create`.
fn patch_wrangler_toml(work_dir: &Path, kv_id: &str) -> Result<(), String> {
    let path = work_dir.join("wrangler.toml");
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("read wrangler.toml: {e}"))?;
    let next = raw.replace("REPLACE_WITH_relaybase-app_ID", kv_id);
    std::fs::write(&path, next).map_err(|e| format!("write wrangler.toml: {e}"))
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

    loop {
        stdout_line.clear();
        stderr_line.clear();
        let s_out = stdout.read_line(&mut stdout_line).await.map_err(|e| format!("read stdout: {e}"))?;
        let s_err = stderr.read_line(&mut stderr_line).await.map_err(|e| format!("read stderr: {e}"))?;

        if s_out == 0 && s_err == 0 {
            break;
        }
        if !stdout_line.is_empty() {
            stdout_buf.push_str(&stdout_line);
            let _ = app.emit(
                "install-log",
                LogEvent {
                    step: step.into(),
                    level: "stdout".into(),
                    line: stdout_line.trim_end().to_string(),
                },
            );
        }
        if !stderr_line.is_empty() {
            let _ = app.emit(
                "install-log",
                LogEvent {
                    step: step.into(),
                    level: "stderr".into(),
                    line: stderr_line.trim_end().to_string(),
                },
            );
        }
    }

    let status = child.wait().await.map_err(|e| format!("wait: {e}"))?;
    if !status.success() {
        return Err(format!("wrangler {step} exited with status {status}"));
    }
    Ok(stdout_buf)
}

/// Parse the KV namespace id from `wrangler kv namespace create` output.
fn parse_kv_id(output: &str) -> Option<String> {
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
    // Fallback: reuse parse_kv_id (some versions print just `id = ...`)
    parse_kv_id(output)
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
) -> Result<AutoInstallResult, String> {
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("A Cloudflare API token is required.".into());
    }

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
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "prepare".into(),
            level: "info".into(),
            line: format!("Staged working copy at {}", work_dir.display()),
        },
    );

    // 1) KV namespace
    let kv_out = run_wrangler(
        &app,
        "kv",
        &work_dir,
        &["kv", "namespace", "create", KV_NAMESPACE],
        &api_token,
        None,
    )
    .await?;
    let kv_id = parse_kv_id(&kv_out).ok_or_else(|| {
        format!("Could not parse KV namespace id from wrangler output:\n{kv_out}")
    })?;
    patch_wrangler_toml(&work_dir, &kv_id)?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "kv".into(),
            level: "info".into(),
            line: format!("KV namespace {KV_NAMESPACE} ready (id {kv_id})"),
        },
    );

    // 2) R2 bucket (ignore "already exists" errors)
    let r2_result = run_wrangler(
        &app,
        "r2",
        &work_dir,
        &["r2", "bucket", "create", R2_BUCKET],
        &api_token,
        None,
    )
    .await;
    if let Err(e) = r2_result {
        let msg = e.to_string();
        if !msg.to_lowercase().contains("already exists") && !msg.to_lowercase().contains("exists") {
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

    // 2b) D1 databases — create each, patch id into wrangler.toml, apply migrations.
    let mut d1_ids: Vec<String> = Vec::with_capacity(D1_DATABASES.len());
    for (_binding, db_name, migrations_dir, placeholder) in D1_DATABASES {
        let create_out = run_wrangler(
            &app,
            "d1-create",
            &work_dir,
            &["d1", "create", db_name],
            &api_token,
            None,
        )
        .await?;
        let db_id = parse_d1_id(&create_out).ok_or_else(|| {
            format!("Could not parse D1 id for {db_name} from wrangler output:\n{create_out}")
        })?;
        patch_d1_id(&work_dir, placeholder, &db_id)?;
        let _ = app.emit(
            "install-log",
            LogEvent {
                step: "d1".into(),
                level: "info".into(),
                line: format!("D1 {db_name} created (id {db_id})"),
            },
        );

        // Apply migrations for this database.
        run_wrangler(
            &app,
            "d1-migrate",
            &work_dir,
            &[
                "d1",
                "migrations",
                "apply",
                "--remote",
                &format!("--migrations-dir={migrations_dir}"),
                db_name,
            ],
            &api_token,
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
    let admin_token = generate_admin_token();
    run_wrangler(
        &app,
        "secret",
        &work_dir,
        &["secret", "put", "ADMIN_TOKEN"],
        &api_token,
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

    // 3b) Cloudflare runtime secrets so the Worker can send mail without the
    //     ops dashboard syncing them into KV.
    run_wrangler(
        &app,
        "secret",
        &work_dir,
        &["secret", "put", "CF_ACCOUNT_ID"],
        &api_token,
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

    run_wrangler(
        &app,
        "secret",
        &work_dir,
        &["secret", "put", "CF_API_TOKEN"],
        &api_token,
        Some(api_token.as_bytes()),
    )
    .await?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "secret".into(),
            level: "info".into(),
            line: "CF_API_TOKEN secret set".to_string(),
        },
    );

    // 4) Deploy
    let deploy_out = run_wrangler(
        &app,
        "deploy",
        &work_dir,
        &["deploy"],
        &api_token,
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

    // Best-effort: clean up the staged copy.
    let _ = std::fs::remove_dir_all(&work_dir);

    Ok(AutoInstallResult {
        worker_url,
        worker_script_name: DEFAULT_SCRIPT.to_string(),
        admin_token,
        kv_namespace_id: kv_id,
        r2_bucket: R2_BUCKET.to_string(),
        account_id,
        d1_logs_id: d1_ids.get(0).cloned().unwrap_or_default(),
        d1_inbox_index_id: d1_ids.get(1).cloned().unwrap_or_default(),
        d1_db_id: d1_ids.get(2).cloned().unwrap_or_default(),
    })
}

/// Merge an auto-install result into stored credentials (preserves
/// Relaybase account + CF account id if already present).
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
        api_token: existing.api_token.clone(),
        worker_url: result.worker_url.clone(),
        admin_token: result.admin_token.clone(),
        worker_script_name: result.worker_script_name.clone(),
        license_key: existing.license_key.clone(),
        relaybase_account_id: existing.relaybase_account_id.clone(),
        relaybase_email: existing.relaybase_email.clone(),
        relaybase_session: existing.relaybase_session.clone(),
        relaybase_tier: existing.relaybase_tier.clone(),
    }
}
