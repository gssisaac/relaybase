use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use super::layout::{current_scope_id, restrict_file_permissions, scoped_dir, EMAIL_PREFS_FILE};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailPrefs {
    pub version: u32,
    pub account_colors: HashMap<String, String>,
}

impl Default for EmailPrefs {
    fn default() -> Self {
        Self {
            version: 1,
            account_colors: HashMap::new(),
        }
    }
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
