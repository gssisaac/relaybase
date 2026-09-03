use crate::auth::owner_session::current_console_access_token;
use crate::cloudflare::oauth::{cf_oauth_if_present, require_cf_oauth};
use crate::storage::{
    load_credentials, load_credentials_merged, save_credentials,
};

use super::cancel::request_install_cancel;
use super::credentials::{merge_into_credentials, push_cf_api_token_secret};
use super::install::{auto_install_worker, update_installed_worker};
use super::manifest::check_worker_update;
use super::probe::probe_install_resources;
use super::rollback::rollback_all_install;
use super::schema::{init_worker_db, migrate_worker_db};
use super::types::{
    AutoInstallResult, InitDbResult, InstallDecision, InstallProbeResult,
    WorkerUpdateCheck, WorkerUpdateTarget,
};
use super::url::{preview_worker_update_target, worker_urls_match};

/// Auth is the in-memory OAuth session (refreshed if needed).
#[tauri::command]
pub async fn probe_auto_install(
    account_id: Option<String>,
) -> Result<InstallProbeResult, String> {
    let oauth = require_cf_oauth().await?;
    let id = account_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or(oauth.account_id);
    probe_install_resources(oauth.access_token, Some(id)).await
}

#[tauri::command]
pub async fn auto_install_routing_worker(
    app: tauri::AppHandle,
    account_id: Option<String>,
    server_token: Option<String>,
    decisions: Option<Vec<InstallDecision>>,
    wipe_confirmation: Option<String>,
) -> Result<AutoInstallResult, String> {
    let server = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let oauth = require_cf_oauth().await?;
    let id = account_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| oauth.account_id.clone());
    let result = auto_install_worker(
        app,
        oauth.access_token,
        Some(id.clone()),
        server.clone(),
        decisions.unwrap_or_default(),
        wipe_confirmation,
    )
    .await?;
    let existing = load_credentials()?.unwrap_or_default();
    let next = merge_into_credentials(&existing, &result, Some(id));
    save_credentials(&next)?;
    Ok(result)
}

/// Compare the deployed Worker version against the hosted install manifest.
/// Only offers an update when the worker is behind the desktop version and
/// the manifest does not exceed the desktop version.
#[tauri::command]
pub async fn check_worker_update_cmd() -> Result<WorkerUpdateCheck, String> {
    let creds = load_credentials_merged()?;
    let current = creds
        .worker_version
        .trim()
        .to_string();
    let desktop = env!("CARGO_PKG_VERSION").to_string();
    check_worker_update(
        if current.is_empty() {
            None
        } else {
            Some(current)
        },
        desktop,
    )
    .await
}

/// Compare the saved Worker URL with the workers.dev URL of the OAuth account.
/// Does not upload anything.
#[tauri::command]
pub async fn preview_worker_update_target_cmd() -> Result<WorkerUpdateTarget, String> {
    let creds = load_credentials_merged()?;
    if creds.worker_url.trim().is_empty() {
        return Err("No Worker URL saved. Complete install first.".into());
    }
    let oauth = require_cf_oauth().await?;
    preview_worker_update_target(
        &oauth.access_token,
        &oauth.account_id,
        &creds.worker_url,
        &creds.worker_script_name,
    )
    .await
}

/// Download the latest install ZIP and re-deploy the Worker (keeps D1).
#[tauri::command]
pub async fn update_installed_worker_cmd(
    app: tauri::AppHandle,
    server_token: Option<String>,
) -> Result<AutoInstallResult, String> {
    let creds = load_credentials_merged()?;
    if creds.worker_url.trim().is_empty() {
        return Err("No Worker URL saved. Complete install first.".into());
    }
    let oauth = require_cf_oauth().await?;
    let server = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let mut result = update_installed_worker(
        app,
        oauth.access_token,
        Some(oauth.account_id.clone()),
        server,
    )
    .await?;
    if !creds.worker_url.trim().is_empty()
        && !worker_urls_match(&creds.worker_url, &result.worker_url)
    {
        // Same account, custom domain — keep the URL the user already uses.
        result.worker_url = creds.worker_url.trim().trim_end_matches('/').to_string();
    }
    let existing = load_credentials()?.unwrap_or_default();
    let next = merge_into_credentials(&existing, &result, Some(oauth.account_id));
    save_credentials(&next)?;
    Ok(result)
}

/// Stop an in-flight auto-install. Does not delete Cloudflare resources —
/// the UI offers a separate Rollback action after stop/error/complete.
#[tauri::command]
pub fn cancel_auto_install() {
    request_install_cancel();
}

/// Delete every Relaybase Worker / D1 / R2 resource in the connected account.
#[tauri::command]
pub async fn rollback_auto_install(
    app: tauri::AppHandle,
    account_id: Option<String>,
    wipe_confirmation: Option<String>,
) -> Result<(), String> {
    let oauth = require_cf_oauth().await?;
    let id = account_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or(oauth.account_id);
    rollback_all_install(app, oauth.access_token, Some(id), wipe_confirmation).await?;
    if let Ok(Some(mut creds)) = load_credentials() {
        creds.worker_url.clear();
        creds.worker_script_name.clear();
        creds.worker_version.clear();
        let _ = save_credentials(&creds);
    }
    Ok(())
}

/// Empty D1 only. `clear` is rejected — wipe by deleting D1s in Cloudflare.
#[tauri::command]
pub async fn init_worker_db_cmd(
    worker_url: String,
    clear: bool,
    _wipe_confirmation: Option<String>,
    _account_id: Option<String>,
) -> Result<InitDbResult, String> {
    if clear {
        return Err(
            "init-db cannot clear existing data. Delete the D1 databases in Cloudflare, \
             create empty ones, then call init-db. To apply pending schema only, use migrate-db."
                .into(),
        );
    }
    let cf = cf_oauth_if_present().await?;
    init_worker_db(
        &worker_url,
        None,
        current_console_access_token().as_deref(),
        cf.as_ref().map(|o| o.access_token.as_str()),
    )
    .await
}

/// Pending migrations only. Never drops tables.
#[tauri::command]
pub async fn migrate_worker_db_cmd(
    worker_url: String,
) -> Result<InitDbResult, String> {
    let cf = cf_oauth_if_present().await?;
    migrate_worker_db(
        &worker_url,
        None,
        current_console_access_token().as_deref(),
        cf.as_ref().map(|o| o.access_token.as_str()),
    )
    .await
}

/// Push a one-shot server token to the deployed Worker
/// as the `CF_API_TOKEN` secret. The token is not written to disk. Auth is
/// the in-memory OAuth access token (refreshed if needed).
#[tauri::command]
pub async fn push_server_token(server_token: String) -> Result<serde_json::Value, String> {
    let server = server_token.trim().to_string();
    if server.is_empty() {
        return Err("Server token is empty.".into());
    }
    let oauth = require_cf_oauth().await?;
    let creds = load_credentials_merged()?;
    if creds.worker_script_name.is_empty() {
        return Err("No deployed Worker found. Install the routing Worker first.".into());
    }

    let pushed_at = push_cf_api_token_secret(
        &oauth.account_id,
        &creds.worker_script_name,
        &oauth.access_token,
        &server,
    )
    .await?;

    Ok(serde_json::json!({
        "ok": true,
        "message": "Server token pushed to Worker as CF_API_TOKEN.",
        "pushedAt": pushed_at
    }))
}
