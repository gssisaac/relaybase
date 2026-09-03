use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use super::layout::{
    ensure_dir, legacy_credentials_path, relaybase_dir, remove_file_if_exists,
    restrict_file_permissions, workspace_path, LEGACY_CREDENTIALS_FILE, TEAM_LOGIN_FILE,
    WORKSPACE_FILE,
};
use super::memory_session::{apply_cf_oauth_session, clear_cf_oauth_session};
use crate::cloudflare::oauth::delete_keyring_oauth_refresh;

const DISK_CREDENTIAL_KEYS: &[&str] = &[
    "accountId",
    "workerUrl",
    "workerScriptName",
    "workerVersion",
    "relaybaseAccountId",
    "relaybaseEmail",
    "relaybaseSession",
];

/// Credentials persisted to disk (`~/.relaybase/workspace.json`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DiskCredentials {
    pub account_id: String,
    pub worker_url: String,
    pub worker_script_name: String,
    #[serde(default)]
    pub worker_version: String,
    #[serde(default)]
    pub relaybase_account_id: String,
    #[serde(default)]
    pub relaybase_email: String,
    #[serde(default)]
    pub relaybase_session: String,
}

/// Full credential struct exposed to TypeScript. Contains both disk fields
/// and in-memory tokens.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredCredentials {
    pub account_id: String,
    #[serde(default)]
    pub install_token: String,
    pub worker_url: String,
    pub worker_script_name: String,
    #[serde(default)]
    pub worker_version: String,
    #[serde(default)]
    pub relaybase_account_id: String,
    #[serde(default)]
    pub relaybase_email: String,
    #[serde(default)]
    pub relaybase_session: String,
    #[serde(default)]
    pub cf_oauth_access_token: String,
    #[serde(default)]
    pub cf_oauth_refresh_token: String,
    #[serde(default)]
    pub cf_oauth_access_expires_at: String,
    /// Cloudflare account id resolved from the OAuth flow.
    pub cf_oauth_account_id: String,
}

fn credentials_for_disk(creds: &StoredCredentials) -> DiskCredentials {
    DiskCredentials {
        account_id: creds.account_id.trim().to_string(),
        worker_url: creds.worker_url.trim().to_string(),
        worker_script_name: creds.worker_script_name.trim().to_string(),
        worker_version: creds.worker_version.trim().to_string(),
        relaybase_account_id: creds.relaybase_account_id.trim().to_string(),
        relaybase_email: creds.relaybase_email.trim().to_string(),
        relaybase_session: creds.relaybase_session.trim().to_string(),
    }
}

fn stored_from_disk(disk: DiskCredentials) -> StoredCredentials {
    StoredCredentials {
        account_id: disk.account_id,
        worker_url: disk.worker_url,
        worker_script_name: disk.worker_script_name,
        worker_version: disk.worker_version,
        relaybase_account_id: disk.relaybase_account_id,
        relaybase_email: disk.relaybase_email,
        relaybase_session: disk.relaybase_session,
        ..Default::default()
    }
}

/// Empty or corrupt workspace JSON (e.g. interrupted write) → treat as unconfigured.
fn parse_workspace_json(json: &str) -> Option<serde_json::Value> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return None;
    }
    serde_json::from_str(trimmed).ok()
}

fn write_json_atomic(path: &Path, json: &str) -> Result<(), String> {
    let unique = uuid::Uuid::new_v4().simple();
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let tmp = path.with_file_name(format!("{filename}.{unique}.tmp"));
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    restrict_file_permissions(&tmp);
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    restrict_file_permissions(path);
    Ok(())
}

fn discard_unreadable_workspace(path: &Path, reason: &str) {
    log::warn!(
        "Unreadable workspace file {} ({reason}); treating as unconfigured",
        path.display()
    );
    remove_file_if_exists(path);
}

fn workspace_json_is_dirty(value: &serde_json::Value) -> bool {
    let Some(obj) = value.as_object() else {
        return true;
    };
    for key in obj.keys() {
        if !DISK_CREDENTIAL_KEYS.contains(&key.as_str()) {
            return true;
        }
    }
    for key in [
        "relaybaseAccountId",
        "relaybaseEmail",
        "relaybaseSession",
    ] {
        if let Some(v) = obj.get(key) {
            if v.as_str().is_some_and(|s| s.trim().is_empty()) {
                return true;
            }
        }
    }
    false
}

pub fn save_credentials(creds: &StoredCredentials) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(WORKSPACE_FILE);
    let disk = credentials_for_disk(creds);
    let json = serde_json::to_string_pretty(&disk).map_err(|e| e.to_string())?;

    match write_json_atomic(&path, &json) {
        Ok(()) => {
            remove_file_if_exists(&dir.join(LEGACY_CREDENTIALS_FILE));
            Ok(())
        }
        Err(e) if e.contains("No such file") || e.contains("not found") => {
            // Parent vanished between ensure and write — recreate and retry once.
            ensure_dir()?;
            write_json_atomic(&path, &json).map_err(|e2| {
                format!(
                    "Failed to write workspace to {} after creating {}: {e2}",
                    path.display(),
                    dir.display()
                )
            })?;
            remove_file_if_exists(&dir.join(LEGACY_CREDENTIALS_FILE));
            Ok(())
        }
        Err(e) => Err(format!(
            "Failed to write workspace to {}: {e}",
            path.display()
        )),
    }
}

pub fn load_credentials() -> Result<Option<StoredCredentials>, String> {
    let dir = relaybase_dir()?;
    let current = dir.join(WORKSPACE_FILE);
    let legacy = dir.join(LEGACY_CREDENTIALS_FILE);
    // Prefer the current name; fall back to the pre-rename file.
    let (path, from_legacy) = if current.exists() {
        (current, false)
    } else if legacy.exists() {
        (legacy.clone(), true)
    } else {
        return Ok(None);
    };
    let json = fs::read_to_string(&path).map_err(|e| {
        format!(
            "Failed to read workspace from {}: {e}",
            path.display()
        )
    })?;
    let Some(value) = parse_workspace_json(&json) else {
        discard_unreadable_workspace(&path, "empty or invalid JSON");
        return Ok(None);
    };
    let Ok(disk) = serde_json::from_value(value.clone()) else {
        discard_unreadable_workspace(&path, "invalid schema");
        return Ok(None);
    };
    let creds = stored_from_disk(disk);
    // Drop leftover tokens / empty console keys, and migrate credentials.json
    // → workspace.json so both never stay on disk together.
    if workspace_json_is_dirty(&value) || from_legacy {
        save_credentials(&creds)?;
    } else if legacy.exists() {
        remove_file_if_exists(&legacy);
    }
    Ok(Some(creds))
}

/// Load disk credentials and merge the in-memory OAuth session when present.
pub fn load_credentials_merged() -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    apply_cf_oauth_session(&mut creds);
    Ok(creds)
}

pub fn clear_credentials() -> Result<(), String> {
    clear_cf_oauth_session();
    let current = match workspace_path() {
        Ok(p) => p,
        Err(_) => return Ok(()),
    };
    let legacy = legacy_credentials_path().ok();
    for path in [Some(current), legacy].into_iter().flatten() {
        if !path.exists() {
            continue;
        }
        fs::remove_file(&path).map_err(|e| {
            format!(
                "Failed to delete {}: {e}",
                path.display()
            )
        })?;
    }
    Ok(())
}

/// Delete the entire `~/.relaybase` directory tree. Used by factory reset
/// so the app returns to the initial install screen. The caller is also
/// responsible for clearing the OS keyring and WebKit data.
pub fn clear_all_relaybase_data() -> Result<(), String> {
    clear_cf_oauth_session();
    delete_keyring_oauth_refresh();
    let dir = relaybase_dir()?;
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| {
        format!("Failed to delete {}: {e}", dir.display())
    })?;
    Ok(())
}

// --- Team user login (per-account mobile password) ---
// Stored separately from owner workspace.json so a teammate never holds
// owner identity. Path: ~/.relaybase/team-login.json

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TeamLogin {
    pub worker_url: String,
    pub account_email: String,
    /// Per-account mobile password. **Legacy only.** New writes keep this
    /// empty — the password lives in the OS keyring (`team_session.rs`).
    /// Kept as an `Option`-ish field so old `team-login.json` files with a
    /// plaintext password can still be read once and migrated.
    #[serde(default)]
    pub mobile_password: String,
}

pub fn save_team_login(login: &TeamLogin) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(TEAM_LOGIN_FILE);
    // Never persist the password to disk — identity only.
    let identity = TeamLogin {
        worker_url: login.worker_url.trim().trim_end_matches('/').to_string(),
        account_email: login.account_email.trim().to_lowercase(),
        mobile_password: String::new(),
    };
    let json = serde_json::to_string_pretty(&identity).map_err(|e| e.to_string())?;
    write_json_atomic(&path, &json).map_err(|e| format!("Failed to write team login: {e}"))?;
    Ok(())
}

pub fn load_team_login() -> Result<Option<TeamLogin>, String> {
    let path = relaybase_dir()?.join(TEAM_LOGIN_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("Failed to read team login: {e}"))?;
    let Some(value) = parse_workspace_json(&json) else {
        log::warn!(
            "Unreadable team login file {} (empty or invalid JSON); treating as signed out",
            path.display()
        );
        remove_file_if_exists(&path);
        return Ok(None);
    };
    let Ok(login) = serde_json::from_value(value) else {
        log::warn!(
            "Invalid team login schema in {}; treating as signed out",
            path.display()
        );
        remove_file_if_exists(&path);
        return Ok(None);
    };
    Ok(Some(login))
}

pub fn clear_team_login() -> Result<(), String> {
    let path = relaybase_dir()?.join(TEAM_LOGIN_FILE);
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| format!("Failed to delete team login: {e}"))?;
    Ok(())
}
