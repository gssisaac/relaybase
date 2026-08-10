use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Desktop durable store root: ~/.relaybase (see docs/relaybase-home-storage.md).
/// Do not add alternate roots (Application Support, Keychain, cwd, etc.).
/// Path: ~/.relaybase/credentials.json
const CREDENTIALS_FILE: &str = "credentials.json";
/// Email UI prefs (account colors, etc.). Path: ~/.relaybase/email.json
const EMAIL_PREFS_FILE: &str = "email.json";
/// Local API key plaintext vault. Path: ~/.relaybase/api-keys.json
const API_KEYS_FILE: &str = "api-keys.json";

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailPrefs {
    pub version: u32,
    pub account_colors: std::collections::HashMap<String, String>,
}

impl Default for EmailPrefs {
    fn default() -> Self {
        Self {
            version: 1,
            account_colors: std::collections::HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyVaultEntry {
    pub id: String,
    pub domain: String,
    pub label: Option<String>,
    pub api_key: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyVault {
    pub version: u32,
    pub entries: Vec<ApiKeyVaultEntry>,
}

impl Default for ApiKeyVault {
    fn default() -> Self {
        Self {
            version: 1,
            entries: Vec::new(),
        }
    }
}

fn home_dir() -> Result<PathBuf, String> {
    if let Some(dir) = dirs::home_dir() {
        return Ok(dir);
    }
    if let Some(home) = std::env::var_os("HOME") {
        return Ok(PathBuf::from(home));
    }
    if let Some(home) = std::env::var_os("USERPROFILE") {
        return Ok(PathBuf::from(home));
    }
    Err(
        "Could not resolve home directory (HOME unset). Cannot create ~/.relaybase."
            .into(),
    )
}

fn relaybase_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".relaybase"))
}

fn credentials_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(CREDENTIALS_FILE))
}

/// Create `~/.relaybase` if missing (and parents). Idempotent.
fn ensure_dir() -> Result<PathBuf, String> {
    let dir = relaybase_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| {
            format!(
                "Failed to create {}: {e}. Check that your home folder is writable.",
                dir.display()
            )
        })?;
    } else if !dir.is_dir() {
        return Err(format!(
            "{} exists but is not a directory. Move or delete it, then retry.",
            dir.display()
        ));
    }
    #[cfg(unix)]
    {
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    Ok(dir)
}

#[cfg(unix)]
fn restrict_file_permissions(path: &PathBuf) {
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict_file_permissions(_path: &PathBuf) {}

pub fn save_credentials(creds: &StoredCredentials) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(CREDENTIALS_FILE);
    let json = serde_json::to_string_pretty(creds).map_err(|e| e.to_string())?;

    match fs::write(&path, &json) {
        Ok(()) => {
            restrict_file_permissions(&path);
            Ok(())
        }
        Err(e) if e.kind() == ErrorKind::NotFound => {
            // Parent vanished between ensure and write — recreate and retry once.
            ensure_dir()?;
            fs::write(&path, &json).map_err(|e2| {
                format!(
                    "Failed to write credentials to {} after creating {}: {e2}",
                    path.display(),
                    dir.display()
                )
            })?;
            restrict_file_permissions(&path);
            Ok(())
        }
        Err(e) => Err(format!(
            "Failed to write credentials to {}: {e}",
            path.display()
        )),
    }
}

pub fn load_credentials() -> Result<Option<StoredCredentials>, String> {
    let dir = relaybase_dir()?;
    let path = dir.join(CREDENTIALS_FILE);
    // Missing dir or file → treat as no credentials (do not error).
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!(
            "Failed to read credentials from {}: {e}",
            path.display()
        )
    })?;
    let creds: StoredCredentials = serde_json::from_str(&json).map_err(|e| {
        format!(
            "Invalid credentials file {}: {e}. Delete the file and verify again.",
            path.display()
        )
    })?;
    Ok(Some(creds))
}

pub fn clear_credentials() -> Result<(), String> {
    let path = match credentials_path() {
        Ok(p) => p,
        Err(_) => return Ok(()),
    };
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

pub fn save_email_prefs(prefs: &EmailPrefs) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(EMAIL_PREFS_FILE);
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;

    match fs::write(&path, &json) {
        Ok(()) => {
            restrict_file_permissions(&path);
            Ok(())
        }
        Err(e) if e.kind() == ErrorKind::NotFound => {
            ensure_dir()?;
            fs::write(&path, &json).map_err(|e2| {
                format!(
                    "Failed to write email prefs to {} after creating {}: {e2}",
                    path.display(),
                    dir.display()
                )
            })?;
            restrict_file_permissions(&path);
            Ok(())
        }
        Err(e) => Err(format!(
            "Failed to write email prefs to {}: {e}",
            path.display()
        )),
    }
}

pub fn load_email_prefs() -> Result<Option<EmailPrefs>, String> {
    let dir = relaybase_dir()?;
    let path = dir.join(EMAIL_PREFS_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!("Failed to read email prefs from {}: {e}", path.display())
    })?;
    let prefs: EmailPrefs = serde_json::from_str(&json).map_err(|e| {
        format!(
            "Invalid email prefs file {}: {e}. Delete the file and relaunch.",
            path.display()
        )
    })?;
    Ok(Some(prefs))
}

/// Persist opaque JSON under `~/.relaybase/mail/{relative_path}`.
/// `relative_path` must be a safe relative path (no `..`, absolute, or empty segments).
fn mail_file_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim().trim_start_matches('/');
    if trimmed.is_empty() {
        return Err("Mail path is empty".into());
    }
    if trimmed.contains("..") {
        return Err("Mail path must not contain '..'".into());
    }
    for segment in trimmed.split('/') {
        if segment.is_empty() {
            return Err("Mail path has an empty segment".into());
        }
        if !segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' || c == '%')
        {
            return Err(format!("Mail path segment has invalid characters: {segment}"));
        }
    }
    let base = ensure_dir()?.join("mail");
    Ok(base.join(trimmed))
}

pub fn save_mail_json(relative_path: &str, value: &serde_json::Value) -> Result<(), String> {
    let path = mail_file_path(relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create mail directory {}: {e}",
                parent.display()
            )
        })?;
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
        }
    }
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&path, &json).map_err(|e| {
        format!("Failed to write mail file {}: {e}", path.display())
    })?;
    restrict_file_permissions(&path);
    Ok(())
}

pub fn load_mail_json(relative_path: &str) -> Result<Option<serde_json::Value>, String> {
    let path = mail_file_path(relative_path)?;
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!("Failed to read mail file {}: {e}", path.display())
    })?;
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| {
        format!("Invalid mail file {}: {e}", path.display())
    })?;
    Ok(Some(value))
}

/// Persist opaque JSON under `~/.relaybase/cache/{relative_path}`.
/// Same path rules as mail JSON.
fn cache_file_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim().trim_start_matches('/');
    if trimmed.is_empty() {
        return Err("Cache path is empty".into());
    }
    if trimmed.contains("..") {
        return Err("Cache path must not contain '..'".into());
    }
    for segment in trimmed.split('/') {
        if segment.is_empty() {
            return Err("Cache path has an empty segment".into());
        }
        if !segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' || c == '%')
        {
            return Err(format!(
                "Cache path segment has invalid characters: {segment}"
            ));
        }
    }
    let base = ensure_dir()?.join("cache");
    Ok(base.join(trimmed))
}

pub fn save_cache_json(relative_path: &str, value: &serde_json::Value) -> Result<(), String> {
    let path = cache_file_path(relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create cache directory {}: {e}",
                parent.display()
            )
        })?;
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
        }
    }
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&path, &json).map_err(|e| {
        format!("Failed to write cache file {}: {e}", path.display())
    })?;
    restrict_file_permissions(&path);
    Ok(())
}

pub fn load_cache_json(relative_path: &str) -> Result<Option<serde_json::Value>, String> {
    let path = cache_file_path(relative_path)?;
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!("Failed to read cache file {}: {e}", path.display())
    })?;
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| {
        format!("Invalid cache file {}: {e}", path.display())
    })?;
    Ok(Some(value))
}

pub fn load_api_key_vault() -> Result<ApiKeyVault, String> {
    let path = relaybase_dir()?.join(API_KEYS_FILE);
    if !path.exists() {
        return Ok(ApiKeyVault::default());
    }
    let json = fs::read_to_string(&path).map_err(|e| {
        format!("Failed to read API key vault from {}: {e}", path.display())
    })?;
    let vault: ApiKeyVault = serde_json::from_str(&json).map_err(|e| {
        format!(
            "Invalid API key vault {}: {e}. Delete the file and re-issue keys.",
            path.display()
        )
    })?;
    Ok(vault)
}

pub fn save_api_key_vault(vault: &ApiKeyVault) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(API_KEYS_FILE);
    let mut next = vault.clone();
    if next.version == 0 {
        next.version = 1;
    }
    let json = serde_json::to_string_pretty(&next).map_err(|e| e.to_string())?;
    fs::write(&path, &json).map_err(|e| {
        format!("Failed to write API key vault to {}: {e}", path.display())
    })?;
    restrict_file_permissions(&path);
    Ok(())
}

pub fn upsert_api_key_vault_entry(entry: ApiKeyVaultEntry) -> Result<ApiKeyVault, String> {
    let mut vault = load_api_key_vault()?;
    if let Some(existing) = vault.entries.iter_mut().find(|e| e.id == entry.id) {
        *existing = entry;
    } else {
        vault.entries.insert(0, entry);
    }
    save_api_key_vault(&vault)?;
    Ok(vault)
}

pub fn remove_api_key_vault_entry(id: &str) -> Result<ApiKeyVault, String> {
    let mut vault = load_api_key_vault()?;
    vault.entries.retain(|e| e.id != id);
    save_api_key_vault(&vault)?;
    Ok(vault)
}

/// One-shot: if `mail/desktop` is missing and another user folder exists
/// (legacy cookie userId), rename the newest folder to `desktop`.
pub fn migrate_mail_to_desktop_user() -> Result<Option<String>, String> {
    let mail_root = ensure_dir()?.join("mail");
    if !mail_root.exists() {
        return Ok(None);
    }
    let desktop = mail_root.join("desktop");
    if desktop.exists() {
        return Ok(None);
    }
    let mut candidates: Vec<(std::time::SystemTime, PathBuf)> = Vec::new();
    let entries = fs::read_dir(&mail_root).map_err(|e| {
        format!("Failed to read mail directory {}: {e}", mail_root.display())
    })?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name == "desktop" || name.starts_with('.') {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        candidates.push((modified, path));
    }
    if candidates.is_empty() {
        return Ok(None);
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    let (_mtime, from) = candidates.remove(0);
    let from_name = from
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    fs::rename(&from, &desktop).map_err(|e| {
        format!(
            "Failed to migrate mail/{} → mail/desktop: {e}",
            from_name
        )
    })?;
    Ok(Some(from_name))
}
