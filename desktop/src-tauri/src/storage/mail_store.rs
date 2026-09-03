use std::fs;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use super::layout::{current_scope_id, ensure_dir, restrict_file_permissions};

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
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            #[cfg(unix)]
            {
                let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
            }
        }
    }
    let unique = uuid::Uuid::new_v4().simple();
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let tmp = path.with_file_name(format!("{filename}.{unique}.tmp"));
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
    let unique = uuid::Uuid::new_v4().simple();
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("binary");
    let tmp = path.with_file_name(format!("{filename}.{unique}.tmp"));
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
