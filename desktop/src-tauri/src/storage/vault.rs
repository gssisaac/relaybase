use serde::{Deserialize, Serialize};
use std::fs;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use super::layout::{current_scope_id, restrict_file_permissions, scoped_dir, API_KEYS_FILE};

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
