//! DEV-MODE TESTING ONLY — persist CF OAuth session to
//! `~/.relaybase/tmp/cf-oauth-dev.json` during `tauri dev`.

use crate::secrets::CfOAuthSession;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use super::tmp_fs::{ensure_dir, iso_now_utc, relaybase_tmp_dir, restrict_file_permissions};

const CACHE_FILE: &str = "cf-oauth-dev.json";

const WARNING: &str = "DEV-MODE TESTING ONLY — Cloudflare OAuth tokens on disk for local testing. Never use in production builds.";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheFile {
    #[serde(default)]
    warning: String,
    purpose: String,
    saved_at: String,
    access_token: String,
    refresh_token: String,
    access_expires_at: String,
    account_id: String,
    #[serde(default)]
    client_id: String,
}

fn cache_path() -> Result<PathBuf, String> {
    Ok(relaybase_tmp_dir()?.join(CACHE_FILE))
}

pub fn save(session: &CfOAuthSession) {
    let Ok(path) = cache_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        if ensure_dir(parent).is_err() {
            log::warn!(
                "DEV-MODE TESTING ONLY: could not create {}",
                parent.display()
            );
            return;
        }
    }
    let payload = CacheFile {
        warning: WARNING.to_string(),
        purpose: "cf_oauth_dev_cache".into(),
        saved_at: iso_now_utc(),
        access_token: session.access_token.clone(),
        refresh_token: session.refresh_token.clone(),
        access_expires_at: session.access_expires_at.clone(),
        account_id: session.account_id.clone(),
        client_id: session.client_id.clone(),
    };
    let Ok(json) = serde_json::to_string_pretty(&payload) else {
        return;
    };
    match fs::write(&path, json) {
        Ok(()) => {
            restrict_file_permissions(&path);
            log::info!(
                "DEV-MODE TESTING ONLY: saved CF OAuth session to {}",
                path.display()
            );
        }
        Err(e) => {
            log::warn!(
                "DEV-MODE TESTING ONLY: failed to write CF OAuth cache {}: {e}",
                path.display()
            );
        }
    }
}

pub fn load() -> Option<CfOAuthSession> {
    let path = cache_path().ok()?;
    if !path.exists() {
        return None;
    }
    let json = fs::read_to_string(&path).ok()?;
    let file: CacheFile = serde_json::from_str(&json).ok()?;
    if file.access_token.trim().is_empty() {
        return None;
    }
    Some(CfOAuthSession {
        access_token: file.access_token,
        refresh_token: file.refresh_token,
        access_expires_at: file.access_expires_at,
        account_id: file.account_id,
        client_id: file.client_id,
    })
}

pub fn clear() {
    if let Ok(path) = cache_path() {
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }
}

pub fn hydrate(session_slot: &Mutex<Option<CfOAuthSession>>) {
    let already = session_slot
        .lock()
        .ok()
        .map(|g| g.is_some())
        .unwrap_or(false);
    if already {
        return;
    }
    let Some(session) = load() else {
        return;
    };
    if let Ok(mut guard) = session_slot.lock() {
        *guard = Some(session);
    }
    if let Ok(path) = cache_path() {
        log::info!(
            "DEV-MODE TESTING ONLY: restored CF OAuth session from {}",
            path.display()
        );
    }
}
