use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Temporary local credential store (replaces macOS Keychain while iterating).
/// Path: ~/.relaybase/credentials.json
const CREDENTIALS_FILE: &str = "credentials.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredCredentials {
    pub account_id: String,
    pub api_token: String,
    pub worker_url: String,
    pub admin_token: String,
    pub worker_script_name: String,
    pub license_key: String,
}

fn relaybase_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or_else(|| "Could not resolve home directory for ~/.relaybase".to_string())?;
    Ok(PathBuf::from(home).join(".relaybase"))
}

fn credentials_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(CREDENTIALS_FILE))
}

fn ensure_dir() -> Result<PathBuf, String> {
    let dir = relaybase_dir()?;
    fs::create_dir_all(&dir).map_err(|e| {
        format!(
            "Failed to create {}: {e}",
            dir.display()
        )
    })?;
    Ok(dir)
}

#[cfg(unix)]
fn restrict_permissions(path: &PathBuf) {
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &PathBuf) {}

pub fn save_credentials(creds: &StoredCredentials) -> Result<(), String> {
    ensure_dir()?;
    let path = credentials_path()?;
    let json = serde_json::to_string_pretty(creds).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| {
        format!(
            "Failed to write credentials to {}: {e}",
            path.display()
        )
    })?;
    restrict_permissions(&path);
    Ok(())
}

pub fn load_credentials() -> Result<Option<StoredCredentials>, String> {
    let path = credentials_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!(
            "Failed to read credentials from {}: {e}",
            path.display()
        )
    })?;
    let creds: StoredCredentials =
        serde_json::from_str(&json).map_err(|e| {
            format!(
                "Invalid credentials file {}: {e}. Delete the file and reconnect Cloudflare.",
                path.display()
            )
        })?;
    Ok(Some(creds))
}

pub fn clear_credentials() -> Result<(), String> {
    let path = credentials_path()?;
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| {
        format!(
            "Failed to delete {}: {e}",
            path.display()
        )
    })?;
    Ok(())
}
