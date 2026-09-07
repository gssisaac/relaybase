use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::layout::{
    ensure_dir, legacy_credentials_path, normalize_worker_url_for_scope, relaybase_dir,
    remove_file_if_exists, restrict_file_permissions, resolve_account_scope_id, workspace_path,
    TEAM_LOGIN_FILE, WORKSPACES_FILE,
};
use super::memory_session::{apply_cf_oauth_session, clear_cf_oauth_session};
use crate::cloudflare::oauth::delete_keyring_oauth_refresh;

/// Fields persisted to disk for each workspace entry in `workspaces.json`.
/// Secrets (passtoken, OAuth, refresh tokens) never live here — only
/// endpoint configuration + the persisted `scope_id` so sign-out → sign-in
/// restores the same on-disk data directory.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
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
    /// Opaque account-scope id (`s-{16hex}`) persisted at first creation so
    /// sign-out → sign-in restores the same `~/.relaybase/{scopeId}/` tree.
    #[serde(default)]
    pub scope_id: String,
    #[serde(default)]
    pub last_used_at: String,
}

/// Keymap of all workspaces ever connected on this Mac. The active workspace
/// is selected by `last_active_key` (or the only entry / first entry).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Workspaces {
    pub version: u32,
    #[serde(default)]
    pub last_active_key: String,
    #[serde(default)]
    pub workspaces: BTreeMap<String, WorkspaceEntry>,
}

impl Workspaces {
    /// Effective account id for scope/key resolution (relaybase > cf > none).
    pub fn effective_account_id(entry: &WorkspaceEntry) -> String {
        let rb = entry.relaybase_account_id.trim();
        if !rb.is_empty() {
            return rb.to_string();
        }
        let cf = entry.account_id.trim();
        if !cf.is_empty() {
            return cf.to_string();
        }
        String::new()
    }

    /// Stable key for the keymap: `{effectiveAccountId}|{normalizedWorkerUrl}`.
    pub fn key_for(entry: &WorkspaceEntry) -> String {
        let account = Self::effective_account_id(entry);
        let worker = normalize_worker_url_for_scope(&entry.worker_url);
        if account.is_empty() && worker.is_empty() {
            return "s-legacy".to_string();
        }
        format!("{account}|{worker}")
    }

    /// Resolve the active entry, preferring `last_active_key`, else the only
    /// entry, else the first by key order. Returns `(key, entry)`.
    pub fn active(&self) -> Option<(&String, &WorkspaceEntry)> {
        if let Some(entry) = self.workspaces.get(&self.last_active_key) {
            return Some((&self.last_active_key, entry));
        }
        if self.workspaces.len() == 1 {
            return self.workspaces.iter().next();
        }
        self.workspaces.iter().next()
    }
}

/// Full credential struct exposed to TypeScript. Contains both disk fields
/// and in-memory tokens. Built from the active workspace entry + memory.
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
    #[serde(default)]
    pub cf_oauth_account_id: String,
    #[serde(default)]
    pub scope_id: String,
}

impl StoredCredentials {
    pub fn from_entry(entry: &WorkspaceEntry) -> Self {
        Self {
            account_id: entry.account_id.clone(),
            install_token: String::new(),
            worker_url: entry.worker_url.clone(),
            worker_script_name: entry.worker_script_name.clone(),
            worker_version: entry.worker_version.clone(),
            relaybase_account_id: entry.relaybase_account_id.clone(),
            relaybase_email: entry.relaybase_email.clone(),
            relaybase_session: entry.relaybase_session.clone(),
            cf_oauth_access_token: String::new(),
            cf_oauth_refresh_token: String::new(),
            cf_oauth_access_expires_at: String::new(),
            cf_oauth_account_id: String::new(),
            scope_id: entry.scope_id.clone(),
        }
    }

    pub fn merge_into_entry(&self, existing: &WorkspaceEntry) -> WorkspaceEntry {
        let mut next = existing.clone();
        if !self.account_id.trim().is_empty() {
            next.account_id = self.account_id.trim().to_string();
        }
        if !self.worker_url.trim().is_empty() {
            next.worker_url = self.worker_url.trim().trim_end_matches('/').to_string();
        }
        if !self.worker_script_name.trim().is_empty() {
            next.worker_script_name = self.worker_script_name.trim().to_string();
        }
        if !self.worker_version.trim().is_empty() {
            next.worker_version = self.worker_version.trim().to_string();
        }
        if !self.relaybase_account_id.trim().is_empty() {
            next.relaybase_account_id = self.relaybase_account_id.trim().to_string();
        }
        if !self.relaybase_email.trim().is_empty() {
            next.relaybase_email = self.relaybase_email.trim().to_string();
        }
        if !self.relaybase_session.trim().is_empty() {
            next.relaybase_session = self.relaybase_session.trim().to_string();
        }
        next
    }
}

fn parse_json_or_discard(path: &Path, reason: &str) -> Option<serde_json::Value> {
    let json = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return None,
    };
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return None;
    }
    match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(v) => Some(v),
        Err(_) => {
            log::warn!("Unreadable workspace file {} ({reason})", path.display());
            remove_file_if_exists(path);
            None
        }
    }
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

fn workspaces_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(WORKSPACES_FILE))
}

fn resolve_account_scope_id_from_entry(entry: &WorkspaceEntry) -> String {
    let creds = StoredCredentials::from_entry(entry);
    resolve_account_scope_id(&creds, None)
}

fn migrate_legacy_workspace_to_keymap() -> Result<(), String> {
    let new_path = workspaces_path()?;
    if new_path.exists() {
        return Ok(());
    }
    let legacy_path = workspace_path()?;
    if !legacy_path.exists() {
        return Ok(());
    }
    let Some(value) = parse_json_or_discard(&legacy_path, "invalid JSON during migration") else {
        remove_file_if_exists(&legacy_path);
        return Ok(());
    };
    let entry = WorkspaceEntry {
        account_id: value.get("accountId").and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        worker_url: value.get("workerUrl").and_then(|v| v.as_str()).unwrap_or("").trim().trim_end_matches('/').to_string(),
        worker_script_name: value.get("workerScriptName").and_then(|v| v.as_str()).unwrap_or("relaybase-api").trim().to_string(),
        worker_version: value.get("workerVersion").and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        relaybase_account_id: value.get("relaybaseAccountId").and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        relaybase_email: value.get("relaybaseEmail").and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        relaybase_session: value.get("relaybaseSession").and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        scope_id: String::new(),
        last_used_at: now_iso_utc(),
    };
    let key = Workspaces::key_for(&entry);
    let mut with_scope = entry;
    with_scope.scope_id = resolve_account_scope_id_from_entry(&with_scope);
    let mut workspaces = Workspaces {
        version: 1,
        last_active_key: key.clone(),
        workspaces: BTreeMap::new(),
    };
    workspaces.workspaces.insert(key.clone(), with_scope);
    save_workspaces(&workspaces)?;
    remove_file_if_exists(&legacy_path);
    Ok(())
}

fn load_workspaces_raw() -> Result<Workspaces, String> {
    migrate_legacy_workspace_to_keymap()?;
    let path = workspaces_path()?;
    if !path.exists() {
        return Ok(Workspaces::default());
    }
    let Some(value) = parse_json_or_discard(&path, "invalid JSON") else {
        return Ok(Workspaces::default());
    };
    let workspaces: Workspaces = serde_json::from_value(value).unwrap_or_else(|e| {
        log::warn!("Invalid workspaces.json schema: {e}; starting fresh");
        Workspaces::default()
    });
    Ok(workspaces)
}

pub fn save_workspaces(workspaces: &Workspaces) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(WORKSPACES_FILE);
    let json = serde_json::to_string_pretty(workspaces).map_err(|e| e.to_string())?;
    write_json_atomic(&path, &json)?;
    Ok(())
}

pub fn upsert_active_workspace(entry: WorkspaceEntry) -> Result<String, String> {
    let mut workspaces = load_workspaces_raw()?;
    let mut entry = entry;
    if entry.scope_id.trim().is_empty() {
        entry.scope_id = resolve_account_scope_id_from_entry(&entry);
    }
    entry.last_used_at = now_iso_utc();
    let key = Workspaces::key_for(&entry);
    workspaces.workspaces.insert(key.clone(), entry);
    workspaces.last_active_key = key.clone();
    save_workspaces(&workspaces)?;
    Ok(key)
}

pub fn set_active_workspace(key: &str) -> Result<(), String> {
    let mut workspaces = load_workspaces_raw()?;
    if !workspaces.workspaces.contains_key(key) {
        return Err(format!("Unknown workspace key: {key}"));
    }
    workspaces.last_active_key = key.to_string();
    if let Some(entry) = workspaces.workspaces.get_mut(key) {
        entry.last_used_at = now_iso_utc();
    }
    save_workspaces(&workspaces)
}

pub fn list_workspaces() -> Result<Workspaces, String> {
    load_workspaces_raw()
}

pub fn remove_workspace(key: &str) -> Result<(), String> {
    let mut workspaces = load_workspaces_raw()?;
    if workspaces.workspaces.remove(key).is_none() {
        return Ok(());
    }
    if workspaces.last_active_key == key {
        workspaces.last_active_key = workspaces.workspaces.keys().next().cloned().unwrap_or_default();
    }
    save_workspaces(&workspaces)
}

pub fn load_active_workspace() -> Result<Option<WorkspaceEntry>, String> {
    let workspaces = load_workspaces_raw()?;
    Ok(workspaces.active().map(|(_, e)| e.clone()))
}

pub fn load_credentials() -> Result<Option<StoredCredentials>, String> {
    let entry = match load_active_workspace()? {
        Some(e) => e,
        None => return Ok(None),
    };
    let mut creds = StoredCredentials::from_entry(&entry);
    apply_cf_oauth_session(&mut creds);
    Ok(Some(creds))
}

pub fn load_credentials_merged() -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    if creds.cf_oauth_access_token.is_empty() {
        apply_cf_oauth_session(&mut creds);
    }
    Ok(creds)
}

pub fn save_credentials(creds: &StoredCredentials) -> Result<(), String> {
    let existing = load_active_workspace()?.unwrap_or_default();
    let mut entry = creds.merge_into_entry(&existing);
    if entry.scope_id.trim().is_empty() {
        entry.scope_id = resolve_account_scope_id_from_entry(&entry);
    }
    entry.last_used_at = now_iso_utc();
    upsert_active_workspace(entry)?;
    let legacy = legacy_credentials_path()?;
    if legacy.exists() {
        remove_file_if_exists(&legacy);
    }
    Ok(())
}

/// Sign-out: clear in-memory access only. The `workspaces.json` keymap is
/// preserved so the next sign-in restores the same scope id and on-disk
/// data directory. The OS keyring is also preserved.
pub fn clear_credentials() -> Result<(), String> {
    clear_cf_oauth_session();
    Ok(())
}

pub fn clear_all_relaybase_data() -> Result<(), String> {
    clear_cf_oauth_session();
    delete_keyring_oauth_refresh();
    let dir = relaybase_dir()?;
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| format!("Failed to delete {}: {e}", dir.display()))?;
    Ok(())
}

// --- Team user login (per-account mobile password) ---
// Stored separately from owner workspaces so a teammate never holds
// owner identity. Path: ~/.relaybase/team-login.json

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TeamLogin {
    pub worker_url: String,
    pub account_email: String,
    #[serde(default)]
    pub mobile_password: String,
}

pub fn save_team_login(login: &TeamLogin) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(TEAM_LOGIN_FILE);
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
    let Some(value) = parse_json_or_discard(&path, "empty or invalid JSON") else {
        return Ok(None);
    };
    let Ok(login) = serde_json::from_value(value) else {
        log::warn!("Invalid team login schema in {}; treating as signed out", path.display());
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

fn now_iso_utc() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = (secs / 86400) as i64;
    let rem = secs % 86400;
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;
    let (y, mo, dd) = days_to_ymd(days);
    format!("{y:04}-{mo:02}-{dd:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}
