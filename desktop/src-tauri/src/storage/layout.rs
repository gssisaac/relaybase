use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use super::credentials::{load_credentials, load_team_login, StoredCredentials, TeamLogin};

pub const WORKSPACE_FILE: &str = "workspace.json";
pub const LEGACY_CREDENTIALS_FILE: &str = "credentials.json";
pub const EMAIL_PREFS_FILE: &str = "email.json";
pub const API_KEYS_FILE: &str = "api-keys.json";
pub const STORAGE_LAYOUT_MARKER_FILE: &str = "storage-layout-v2.json";
pub const TEAM_LOGIN_FILE: &str = "team-login.json";

pub fn home_dir() -> Result<PathBuf, String> {
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

pub fn relaybase_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".relaybase"))
}

pub fn workspace_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(WORKSPACE_FILE))
}

pub fn legacy_credentials_path() -> Result<PathBuf, String> {
    Ok(relaybase_dir()?.join(LEGACY_CREDENTIALS_FILE))
}

pub fn remove_file_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

/// Create `~/.relaybase` if missing (and parents). Idempotent.
pub fn ensure_dir() -> Result<PathBuf, String> {
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
pub fn restrict_file_permissions(path: &Path) {
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
pub fn restrict_file_permissions(_path: &Path) {}

/// Normalize a Worker URL for scope hashing: trim, strip trailing `/`,
/// lowercase the host portion only (scheme + path kept as-is).
pub fn normalize_worker_url_for_scope(raw: &str) -> String {
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
pub fn scoped_dir(scope_id: &str) -> Result<PathBuf, String> {
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
