//! DEV-MODE TESTING ONLY — owner/team session secrets on disk instead of the
//! macOS login keychain during `tauri dev`.
//!
//! Path: `~/.relaybase/tmp/keyring-dev/{service}__{account}.json`

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use super::tmp_fs::{
    ensure_dir, iso_now_utc, relaybase_tmp_dir, restrict_file_permissions, safe_filename_part,
};

const WARNING: &str = "DEV-MODE TESTING ONLY — session secrets on disk for local testing. Never use in production builds.";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheFile {
    #[serde(default)]
    warning: String,
    service: String,
    account: String,
    saved_at: String,
    password: String,
}

fn cache_dir() -> Result<PathBuf, String> {
    Ok(relaybase_tmp_dir()?.join("keyring-dev"))
}

fn cache_path(service: &str, account: &str) -> Result<PathBuf, String> {
    let filename = format!(
        "{}__{}.json",
        safe_filename_part(service),
        safe_filename_part(account)
    );
    Ok(cache_dir()?.join(filename))
}

pub fn get_password(service: &str, account: &str) -> Result<Option<String>, String> {
    let path = cache_path(service, account)?;
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!(
            "DEV-MODE TESTING ONLY: failed to read {}: {e}",
            path.display()
        )
    })?;
    let file: CacheFile = serde_json::from_str(&json).map_err(|e| {
        format!(
            "DEV-MODE TESTING ONLY: invalid dev keyring file {}: {e}",
            path.display()
        )
    })?;
    if file.password.is_empty() {
        return Ok(None);
    }
    Ok(Some(file.password))
}

pub fn set_password(service: &str, account: &str, password: &str) -> Result<(), String> {
    let dir = cache_dir()?;
    ensure_dir(&dir)?;
    let path = cache_path(service, account)?;
    let payload = CacheFile {
        warning: WARNING.to_string(),
        service: service.to_string(),
        account: account.to_string(),
        saved_at: iso_now_utc(),
        password: password.to_string(),
    };
    let json = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("DEV-MODE TESTING ONLY: failed to encode dev keyring file: {e}"))?;
    fs::write(&path, json).map_err(|e| {
        format!(
            "DEV-MODE TESTING ONLY: failed to write {}: {e}",
            path.display()
        )
    })?;
    restrict_file_permissions(&path);
    log::info!(
        "DEV-MODE TESTING ONLY: saved keyring secret to {}",
        path.display()
    );
    Ok(())
}

pub fn delete_password(service: &str, account: &str) {
    if let Ok(path) = cache_path(service, account) {
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }
}

pub fn has_password(service: &str, account: &str) -> Result<bool, String> {
    Ok(cache_path(service, account)?.exists())
}
