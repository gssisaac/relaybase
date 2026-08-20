use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Desktop durable store root: ~/.relaybase (see docs/relaybase-home-storage.md).
/// Do not add alternate roots (Application Support, Keychain, cwd, etc.).
/// Path: ~/.relaybase/credentials.json
const CREDENTIALS_FILE: &str = "credentials.json";
/// Email UI prefs (account colors, etc.). Path: ~/.relaybase/{scopeId}/email.json
const EMAIL_PREFS_FILE: &str = "email.json";
/// Local API key plaintext vault. Path: ~/.relaybase/{scopeId}/api-keys.json
const API_KEYS_FILE: &str = "api-keys.json";
/// Marker file recording that the flat→scoped layout migration has run.
/// Path: ~/.relaybase/storage-layout-v2.json
const STORAGE_LAYOUT_MARKER_FILE: &str = "storage-layout-v2.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct StoredCredentials {
    pub account_id: String,
    /// Cloudflare API token used by Tauri wrangler (deploy / KV / R2 / D1 /
    /// `wrangler secret put`). Needs Workers Scripts/KV/R2 Edit. Not pushed
    /// to the Worker as a runtime secret. Migrated from the legacy `apiToken`
    /// field via the serde alias below.
    #[serde(alias = "apiToken", alias = "api_token")]
    pub install_token: String,
    /// Cloudflare API token with Account → Email Sending → Edit, pushed to
    /// the Worker as the `CF_API_TOKEN` wrangler secret so the Worker can send
    /// mail. Separate from `install_token` so a deploy-only token never ends
    /// up authorizing (and failing) Email Sending.
    pub server_token: String,
    /// ISO timestamp of the last successful `wrangler secret put CF_API_TOKEN`
    /// run from Settings. Empty until the server token has been pushed.
    pub server_token_pushed_at: String,
    pub worker_url: String,
    pub admin_token: String,
    pub worker_script_name: String,
    /// Deployed Worker bundle version (from WORKER_VERSION var / connect probe).
    pub worker_version: String,
    pub license_key: String,
    /// Relaybase console account (console.relaybase.xyz) — separate from the
    /// Cloudflare `account_id`/`api_token` above. Populated after the user
    /// logs in from /setup/account.
    /// Struct-level `default` keeps older ~/.relaybase/credentials.json files
    /// (missing these fields) loadable instead of hard-failing save/verify.
    pub relaybase_account_id: String,
    pub relaybase_email: String,
    /// Signed session token from console.relaybase.xyz (stored locally only,
    /// never sent to the product Worker).
    pub relaybase_session: String,
    /// License tier mirrored from the console for feature gating.
    pub relaybase_tier: String,

    // --- Cloudflare OAuth (install token) ---
    // Install token is sourced from CF OAuth. Tokens live in Tauri process
    // memory only — never written to credentials.json. `install_token` above
    // may still hold a legacy manual token on disk when no OAuth session is
    // active.
    pub cf_oauth_access_token: String,
    pub cf_oauth_refresh_token: String,
    /// ISO timestamp of access-token expiry. Empty when not using OAuth.
    pub cf_oauth_access_expires_at: String,
    /// Cloudflare account id resolved from the OAuth flow.
    pub cf_oauth_account_id: String,
}

/// CF OAuth install-token session — process memory only, never written to disk.
#[derive(Debug, Clone)]
pub struct CfOAuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub access_expires_at: String,
    pub account_id: String,
}

static CF_OAUTH_SESSION: Mutex<Option<CfOAuthSession>> = Mutex::new(None);

pub fn set_cf_oauth_session(session: CfOAuthSession) {
    if let Ok(mut guard) = CF_OAUTH_SESSION.lock() {
        *guard = Some(session);
    }
}

pub fn get_cf_oauth_session() -> Option<CfOAuthSession> {
    CF_OAUTH_SESSION
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
}

pub fn clear_cf_oauth_session() {
    if let Ok(mut guard) = CF_OAUTH_SESSION.lock() {
        *guard = None;
    }
}

/// Remove OAuth fields from a credentials struct (disk or API payload).
pub fn strip_oauth_from_credentials(creds: &mut StoredCredentials) {
    creds.cf_oauth_access_token.clear();
    creds.cf_oauth_refresh_token.clear();
    creds.cf_oauth_access_expires_at.clear();
    creds.cf_oauth_account_id.clear();
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
    creds.install_token = session.access_token.clone();
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

fn credentials_for_disk(creds: &StoredCredentials) -> StoredCredentials {
    let mut disk = creds.clone();
    strip_oauth_from_credentials(&mut disk);
    // OAuth access token lives only in memory — do not persist install_token
    // sourced from an active OAuth session.
    if get_cf_oauth_session().is_some() {
        disk.install_token.clear();
    }
    disk
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
    let path = dir.join(CREDENTIALS_FILE);
    let disk = credentials_for_disk(creds);
    let json = serde_json::to_string_pretty(&disk).map_err(|e| e.to_string())?;

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
    let mut creds: StoredCredentials = serde_json::from_str(&json).map_err(|e| {
        format!(
            "Invalid credentials file {}: {e}. Delete the file and verify again.",
            path.display()
        )
    })?;
    // Ignore OAuth tokens persisted before the memory-only migration.
    if !creds.cf_oauth_access_token.is_empty() || !creds.cf_oauth_refresh_token.is_empty() {
        strip_oauth_from_credentials(&mut creds);
        creds.install_token.clear();
    }
    Ok(Some(creds))
}

pub fn clear_credentials() -> Result<(), String> {
    clear_cf_oauth_session();
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
// Stored separately from admin credentials.json so a teammate never holds
// the admin token. Path: ~/.relaybase/team-login.json

const TEAM_LOGIN_FILE: &str = "team-login.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TeamLogin {
    pub worker_url: String,
    pub account_email: String,
    /// Per-account mobile password (plaintext; same model as the Flutter
    /// companion). Stored locally only and sent to the customer Worker as a
    /// Bearer over /mobile/*.
    pub mobile_password: String,
}

pub fn save_team_login(login: &TeamLogin) -> Result<(), String> {
    let dir = ensure_dir()?;
    let path = dir.join(TEAM_LOGIN_FILE);
    let json = serde_json::to_string_pretty(login).map_err(|e| e.to_string())?;
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
