use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Desktop durable store root: ~/.relaybase (see docs/relaybase-home-storage.md).
/// Do not add alternate roots (Application Support, Keychain, cwd, etc.).
/// Path: ~/.relaybase/workspace.json — Worker URL, CF account id, script/version.
/// Secrets (passtoken, OAuth, refresh) live in the OS keyring, not this file.
const WORKSPACE_FILE: &str = "workspace.json";
/// Pre-rename filename. Read once and rewritten to `workspace.json`.
const LEGACY_CREDENTIALS_FILE: &str = "credentials.json";
/// Email UI prefs (account colors, etc.). Path: ~/.relaybase/{scopeId}/email.json
const EMAIL_PREFS_FILE: &str = "email.json";
/// Local API key plaintext vault. Path: ~/.relaybase/{scopeId}/api-keys.json
const API_KEYS_FILE: &str = "api-keys.json";
/// Marker file recording that the flat→scoped layout migration has run.
/// Path: ~/.relaybase/storage-layout-v2.json
const STORAGE_LAYOUT_MARKER_FILE: &str = "storage-layout-v2.json";

/// Keys that may appear in `~/.relaybase/workspace.json`.
/// Everything else is stripped on load and never written back.
const DISK_CREDENTIAL_KEYS: &[&str] = &[
    "accountId",
    "workerUrl",
    "workerScriptName",
    "workerVersion",
    "relaybaseAccountId",
    "relaybaseEmail",
    "relaybaseSession",
];

/// Disk-only shape. Tokens and OAuth session fields are never serialized here.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct DiskCredentials {
    account_id: String,
    worker_url: String,
    worker_script_name: String,
    worker_version: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    relaybase_account_id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    relaybase_email: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    relaybase_session: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct StoredCredentials {
    pub account_id: String,
    /// Unused IPC leftover. OAuth is `cf_oauth_access_token` only.
    /// Never written to `workspace.json`.
    #[serde(alias = "apiToken", alias = "api_token")]
    pub install_token: String,
    pub worker_url: String,
    pub worker_script_name: String,
    /// Deployed Worker bundle version (from WORKER_VERSION var / connect probe).
    pub worker_version: String,
    /// Relaybase console account (console.relaybase.xyz). Written to disk
    /// only when non-empty.
    pub relaybase_account_id: String,
    pub relaybase_email: String,
    /// Signed session token from console.relaybase.xyz (stored locally only,
    /// never sent to the product Worker).
    pub relaybase_session: String,

    // --- Cloudflare OAuth (install token) ---
    // Process memory only. Overlaid onto IPC responses; never on disk.
    pub cf_oauth_access_token: String,
    pub cf_oauth_refresh_token: String,
    /// ISO timestamp of access-token expiry. Empty when not using OAuth.
    pub cf_oauth_access_expires_at: String,
    /// Cloudflare account id resolved from the OAuth flow.
    pub cf_oauth_account_id: String,
}

/// CF OAuth session — process memory only, never written to disk.
#[derive(Debug, Clone)]
pub struct CfOAuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub access_expires_at: String,
    pub account_id: String,
    /// Client id used for this session (install vs passtoken-updater).
    /// Refresh must use the same client; empty = fetch install config.
    pub client_id: String,
}

static CF_OAUTH_SESSION: Mutex<Option<CfOAuthSession>> = Mutex::new(None);

pub fn set_cf_oauth_session(session: CfOAuthSession) {
    if let Ok(mut guard) = CF_OAUTH_SESSION.lock() {
        *guard = Some(session.clone());
    }
    #[cfg(debug_assertions)]
    crate::dev::save_cf_oauth_cache(&session);
}

pub fn get_cf_oauth_session() -> Option<CfOAuthSession> {
    let cached = CF_OAUTH_SESSION
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    if cached.is_some() {
        return cached;
    }
    #[cfg(debug_assertions)]
    {
        let loaded = crate::dev::load_cf_oauth_cache()?;
        set_cf_oauth_session(loaded.clone());
        return Some(loaded);
    }
    #[cfg(not(debug_assertions))]
    None
}

pub fn clear_cf_oauth_session() {
    if let Ok(mut guard) = CF_OAUTH_SESSION.lock() {
        *guard = None;
    }
    #[cfg(debug_assertions)]
    crate::dev::clear_cf_oauth_cache();
}

#[cfg(debug_assertions)]
pub fn hydrate_cf_oauth_session_dev_cache() {
    crate::dev::hydrate(&CF_OAUTH_SESSION);
}

/// Overlay the in-memory OAuth session onto credentials for UI / IPC responses.
pub fn apply_cf_oauth_session(creds: &mut StoredCredentials) {
    let Some(session) = get_cf_oauth_session() else {
        return;
    };
    creds.cf_oauth_access_token = session.access_token.clone();
    creds.cf_oauth_refresh_token = session.refresh_token.clone();
    creds.cf_oauth_access_expires_at = session.access_expires_at.clone();
    creds.cf_oauth_account_id = session.account_id.clone();
    if !session.account_id.is_empty() {
        creds.account_id = session.account_id.clone();
    }
}

/// Load disk credentials and merge the in-memory OAuth session when present.
pub fn load_credentials_merged() -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    apply_cf_oauth_session(&mut creds);
    Ok(creds)
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

fn workspace_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(WORKSPACE_FILE))
}

fn legacy_credentials_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(LEGACY_CREDENTIALS_FILE))
}

fn remove_file_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
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

// --- Account-scoped storage (layout v2) ---
//
// Tenant-owned data (mail, cache, email prefs, API key vault) lives under
// `~/.relaybase/{scopeId}/` so switching Cloudflare or Relaybase console
// accounts isolates cache automatically. The `scopeId` is an opaque SHA-256
// prefix — never the raw `relaybaseAccountId` / CF `accountId` / `workerUrl`.

/// Normalize a Worker URL for scope hashing: trim, strip trailing `/`,
/// lowercase the host portion only (scheme + path kept as-is).
fn normalize_worker_url_for_scope(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(url) = url::Url::parse(trimmed) {
        let host = url.host_str().unwrap_or("").to_lowercase();
        if host.is_empty() {
            return trimmed.to_lowercase();
        }
        let scheme = url.scheme();
        let port = url.port().map(|p| format!(":{p}")).unwrap_or_default();
        let path = url.path().trim_end_matches('/');
        return format!("{scheme}://{host}{port}{path}");
    }
    trimmed.to_lowercase()
}

/// Resolve the opaque account-scope id for the given credentials + optional
/// team login. Returns `s-{16hex}` (SHA-256 prefix over `"{account}|{worker}"`),
/// or `s-legacy` when both parts are empty (migration source only).
pub fn resolve_account_scope_id(
    creds: &StoredCredentials,
    team_login: Option<&TeamLogin>,
) -> String {
    let account_part = {
        let rb = creds.relaybase_account_id.trim();
        if !rb.is_empty() {
            rb.to_string()
        } else {
            let cf = creds.account_id.trim();
            if !cf.is_empty() {
                cf.to_string()
            } else {
                creds.cf_oauth_account_id.trim().to_string()
            }
        }
    };

    let worker_part = {
        let w = creds.worker_url.trim();
        if !w.is_empty() {
            normalize_worker_url_for_scope(w)
        } else if let Some(tl) = team_login {
            normalize_worker_url_for_scope(&tl.worker_url)
        } else {
            String::new()
        }
    };

    if account_part.is_empty() && worker_part.is_empty() {
        return "s-legacy".to_string();
    }

    let hash_input = format!("{account_part}|{worker_part}");
    let mut hasher = Sha256::new();
    hasher.update(hash_input.as_bytes());
    let digest = hasher.finalize();
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    format!("s-{}", &hex[..16])
}

/// Resolve the current scope id by loading credentials + team login from disk.
pub fn current_scope_id() -> Result<String, String> {
    let creds = load_credentials()?.unwrap_or_default();
    let team = load_team_login()?;
    Ok(resolve_account_scope_id(&creds, team.as_ref()))
}

/// Return `~/.relaybase/{scope_id}/`, creating `~/.relaybase` if needed.
/// Does NOT create the scope subdir itself — callers create it on first write.
fn scoped_dir(scope_id: &str) -> Result<PathBuf, String> {
    Ok(ensure_dir()?.join(scope_id))
}

/// Marker file recording that the v2 layout migration has run.
fn storage_layout_marker_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(STORAGE_LAYOUT_MARKER_FILE))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageLayoutMarker {
    pub version: u32,
    pub migrated_at: String,
    pub scope_id: String,
    pub from: String,
}

/// One-shot migration from the flat layout (mail/, cache/, email.json,
/// api-keys.json at the ~/.relaybase root) to the scoped layout
/// (~/.relaybase/{scopeId}/...). Idempotent: if the marker file exists, no-op.
/// Must run AFTER `migrate_mail_to_desktop_user` (which still operates on the
/// legacy flat `mail/` dir).
pub fn migrate_storage_layout_v2() -> Result<StorageLayoutMarker, String> {
    let marker_path = storage_layout_marker_path()?;
    if marker_path.exists() {
        let json = fs::read_to_string(&marker_path).map_err(|e| {
            format!("Failed to read storage layout marker: {e}")
        })?;
        let marker: StorageLayoutMarker = serde_json::from_str(&json).map_err(|e| {
            format!("Invalid storage layout marker: {e}")
        })?;
        return Ok(marker);
    }

    let scope_id = current_scope_id()?;
    let root = ensure_dir()?;
    let scope_dir = root.join(&scope_id);

    let has_legacy = root.join("mail").exists()
        || root.join("cache").exists()
        || root.join(EMAIL_PREFS_FILE).exists()
        || root.join(API_KEYS_FILE).exists();

    if has_legacy {
        fs::create_dir_all(&scope_dir).map_err(|e| {
            format!("Failed to create scope dir {}: {e}", scope_dir.display())
        })?;
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(&scope_dir, fs::Permissions::from_mode(0o700));
        }

        // Move each legacy artifact into the scope dir. Use rename (atomic on
        // same filesystem). If a target already exists (partial migration),
        // skip — the marker write at the end makes this idempotent per-run.
        for name in ["mail", "cache"] {
            let from = root.join(name);
            let to = scope_dir.join(name);
            if from.exists() && !to.exists() {
                fs::rename(&from, &to).map_err(|e| {
                    format!("Failed to move {name} → {scope_id}/{name}: {e}")
                })?;
            }
        }
        for file in [EMAIL_PREFS_FILE, API_KEYS_FILE] {
            let from = root.join(file);
            let to = scope_dir.join(file);
            if from.exists() && !to.exists() {
                fs::rename(&from, &to).map_err(|e| {
                    format!("Failed to move {file} → {scope_id}/{file}: {e}")
                })?;
            }
        }
    }

    let marker = StorageLayoutMarker {
        version: 2,
        migrated_at: now_iso_utc(),
        scope_id: scope_id.clone(),
        from: if has_legacy { "flat".into() } else { "fresh".into() },
    };
    let json = serde_json::to_string_pretty(&marker).map_err(|e| e.to_string())?;
    fs::write(&marker_path, &json).map_err(|e| {
        format!("Failed to write storage layout marker: {e}")
    })?;
    restrict_file_permissions(&marker_path);
    Ok(marker)
}

/// ISO-8601 UTC timestamp for the migration marker.
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
    let (y, mo, dd) = days_to_ymd_local(days);
    format!("{y:04}-{mo:02}-{dd:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd_local(days: i64) -> (i64, i64, i64) {
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

#[cfg(unix)]
fn restrict_file_permissions(path: &PathBuf) {
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict_file_permissions(_path: &PathBuf) {}

pub fn save_credentials(creds: &StoredCredentials) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(WORKSPACE_FILE);
    let disk = credentials_for_disk(creds);
    let json = serde_json::to_string_pretty(&disk).map_err(|e| e.to_string())?;

    match fs::write(&path, &json) {
        Ok(()) => {
            restrict_file_permissions(&path);
            remove_file_if_exists(&dir.join(LEGACY_CREDENTIALS_FILE));
            Ok(())
        }
        Err(e) if e.kind() == ErrorKind::NotFound => {
            // Parent vanished between ensure and write — recreate and retry once.
            ensure_dir()?;
            fs::write(&path, &json).map_err(|e2| {
                format!(
                    "Failed to write workspace to {} after creating {}: {e2}",
                    path.display(),
                    dir.display()
                )
            })?;
            restrict_file_permissions(&path);
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
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| {
        format!(
            "Invalid workspace file {}: {e}. Delete the file and verify again.",
            path.display()
        )
    })?;
    let disk: DiskCredentials = serde_json::from_value(value.clone()).map_err(|e| {
        format!(
            "Invalid workspace file {}: {e}. Delete the file and verify again.",
            path.display()
        )
    })?;
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
    let dir = relaybase_dir()?;
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| {
        format!("Failed to delete {}: {e}", dir.display())
    })?;
    Ok(())
}

pub fn save_email_prefs(prefs: &EmailPrefs) -> Result<(), String> {
    let scope_id = current_scope_id()?;
    let dir = scoped_dir(&scope_id)?;
    fs::create_dir_all(&dir).map_err(|e| {
        format!("Failed to create scope dir {}: {e}", dir.display())
    })?;
    #[cfg(unix)]
    {
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    let path = dir.join(EMAIL_PREFS_FILE);
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;

    match fs::write(&path, &json) {
        Ok(()) => {
            restrict_file_permissions(&path);
            Ok(())
        }
        Err(e) if e.kind() == ErrorKind::NotFound => {
            fs::create_dir_all(&dir).map_err(|e2| {
                format!("Failed to recreate {}: {e2}", dir.display())
            })?;
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
    let scope_id = current_scope_id()?;
    let path = scoped_dir(&scope_id)?.join(EMAIL_PREFS_FILE);
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

/// Mail/cache JSON is rebuildable. Empty or corrupt files (interrupted
/// `fs::write` truncate) are treated as missing so hydrate can fall back.
fn parse_rebuildable_json(json: &str) -> Option<serde_json::Value> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return None;
    }
    serde_json::from_str(trimmed).ok()
}

fn write_json_atomic(path: &Path, json: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    restrict_file_permissions(&tmp);
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    restrict_file_permissions(&path.to_path_buf());
    Ok(())
}

/// Persist opaque JSON under `~/.relaybase/{scopeId}/mail/{relative_path}`.
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
    let scope_id = current_scope_id()?;
    let base = ensure_dir()?.join(&scope_id).join("mail");
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
    write_json_atomic(&path, &json).map_err(|e| {
        format!("Failed to write mail file {}: {e}", path.display())
    })?;
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
    Ok(parse_rebuildable_json(&json))
}

/// Persist binary mail data under `~/.relaybase/{scopeId}/mail/{relative_path}`.
/// `base64_data` is standard base64 (no data-URL prefix).
pub fn save_mail_binary(relative_path: &str, base64_data: &str) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid base64: {e}"))?;
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
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &bytes).map_err(|e| {
        format!("Failed to write mail binary {}: {e}", path.display())
    })?;
    restrict_file_permissions(&tmp);
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    restrict_file_permissions(&path);
    Ok(())
}

/// Read binary mail data as standard base64. Returns `None` when missing.
pub fn load_mail_binary(relative_path: &str) -> Result<Option<String>, String> {
    use base64::Engine as _;
    let path = mail_file_path(relative_path)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|e| {
        format!("Failed to read mail binary {}: {e}", path.display())
    })?;
    Ok(Some(
        base64::prelude::BASE64_STANDARD.encode(bytes),
    ))
}

/// Delete one binary mail file. Missing files are OK.
pub fn delete_mail_binary(relative_path: &str) -> Result<(), String> {
    let path = mail_file_path(relative_path)?;
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| {
        format!("Failed to delete mail binary {}: {e}", path.display())
    })
}

/// Delete a mail subdirectory and all files under it (e.g. draft attachments).
pub fn delete_mail_binary_dir(relative_path: &str) -> Result<(), String> {
    let path = mail_file_path(relative_path)?;
    if !path.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&path).map_err(|e| {
        format!("Failed to delete mail directory {}: {e}", path.display())
    })
}

/// Persist opaque JSON under `~/.relaybase/{scopeId}/cache/{relative_path}`.
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
    let scope_id = current_scope_id()?;
    let base = ensure_dir()?.join(&scope_id).join("cache");
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
    write_json_atomic(&path, &json).map_err(|e| {
        format!("Failed to write cache file {}: {e}", path.display())
    })?;
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
    Ok(parse_rebuildable_json(&json))
}

pub fn load_api_key_vault() -> Result<ApiKeyVault, String> {
    let scope_id = current_scope_id()?;
    let path = scoped_dir(&scope_id)?.join(API_KEYS_FILE);
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
    let scope_id = current_scope_id()?;
    let dir = scoped_dir(&scope_id)?;
    fs::create_dir_all(&dir).map_err(|e| {
        format!("Failed to create scope dir {}: {e}", dir.display())
    })?;
    #[cfg(unix)]
    {
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
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
///
/// **Pre-v2 only.** This operates on the legacy flat `~/.relaybase/mail/`
/// dir. `migrate_storage_layout_v2` must run AFTER this so the renamed
/// `mail/desktop/` is moved into `{scopeId}/mail/desktop/`. After v2
/// migration the root `mail/` no longer exists and this is a harmless no-op.
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

// --- Team user login (per-account mobile password) ---
// Stored separately from owner workspace.json so a teammate never holds
// owner identity. Path: ~/.relaybase/team-login.json

const TEAM_LOGIN_FILE: &str = "team-login.json";

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
    fs::write(&path, &json).map_err(|e| format!("Failed to write team login: {e}"))?;
    restrict_file_permissions(&path);
    Ok(())
}

pub fn load_team_login() -> Result<Option<TeamLogin>, String> {
    let path = relaybase_dir()?.join(TEAM_LOGIN_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("Failed to read team login: {e}"))?;
    let login: TeamLogin = serde_json::from_str(&json).map_err(|e| {
        format!("Invalid team login file: {e}. Delete it and sign in again.")
    })?;
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
