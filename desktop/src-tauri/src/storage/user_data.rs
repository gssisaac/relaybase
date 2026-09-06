use serde::{Deserialize, Serialize};

use super::credentials::{
    load_credentials, load_credentials_merged, save_credentials, StoredCredentials,
};

/// Structured representation of workspace connection settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserConnectionData {
    pub worker_url: String,
    pub account_id: String,
    pub worker_script_name: String,
    pub worker_version: String,
}

pub fn normalize_worker_url_str(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Worker URL is required".into());
    }
    let with_scheme = if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let url = reqwest::Url::parse(&with_scheme).map_err(|_| {
        "Worker URL looks invalid. Use https://relaybase-api.<subdomain>.workers.dev".to_string()
    })?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("Worker URL must be http(s)".into());
    }
    Ok(with_scheme.trim_end_matches('/').to_string())
}

pub fn get_user_connection_data() -> Result<Option<UserConnectionData>, String> {
    let creds = match load_credentials() {
        Ok(Some(c)) => c,
        Ok(None) => return Ok(None),
        Err(e) => return Err(e),
    };
    if creds.worker_url.trim().is_empty() && creds.account_id.trim().is_empty() {
        return Ok(None);
    }
    Ok(Some(UserConnectionData {
        worker_url: creds.worker_url.trim().to_string(),
        account_id: creds.account_id.trim().to_string(),
        worker_script_name: if creds.worker_script_name.trim().is_empty() {
            "relaybase-api".to_string()
        } else {
            creds.worker_script_name.trim().to_string()
        },
        worker_version: creds.worker_version.trim().to_string(),
    }))
}

pub fn save_user_connection_data(
    worker_url: &str,
    account_id: Option<&str>,
    worker_script_name: Option<&str>,
    worker_version: Option<&str>,
) -> Result<StoredCredentials, String> {
    let base = normalize_worker_url_str(worker_url)?;
    let mut creds = match load_credentials() {
        Ok(existing) => existing.unwrap_or_default(),
        Err(e) => {
            log::warn!("load_credentials failed during save_user_connection_data: {e}");
            StoredCredentials::default()
        }
    };
    creds.worker_url = base;
    if let Some(acct) = account_id {
        creds.account_id = acct.trim().to_string();
    }
    creds.worker_script_name = worker_script_name
        .unwrap_or_default()
        .trim()
        .to_string();
    if creds.worker_script_name.is_empty() {
        creds.worker_script_name = "relaybase-api".into();
    }
    if let Some(version) = worker_version {
        let v = version.trim();
        if !v.is_empty() {
            creds.worker_version = v.to_string();
        }
    }
    save_credentials(&creds)?;
    load_credentials_merged()
}

pub fn clear_user_connection_data() -> Result<StoredCredentials, String> {
    let mut creds = match load_credentials() {
        Ok(existing) => existing.unwrap_or_default(),
        Err(e) => {
            log::warn!("load_credentials failed during clear_user_connection_data: {e}");
            StoredCredentials::default()
        }
    };
    creds.worker_url.clear();
    creds.account_id.clear();
    creds.worker_script_name.clear();
    creds.worker_version.clear();
    save_credentials(&creds)?;
    load_credentials_merged()
}

#[tauri::command]
pub async fn get_user_connection() -> Result<Option<UserConnectionData>, String> {
    get_user_connection_data()
}

#[tauri::command]
pub async fn save_user_connection(
    worker_url: String,
    account_id: Option<String>,
    worker_script_name: Option<String>,
    worker_version: Option<String>,
) -> Result<StoredCredentials, String> {
    save_user_connection_data(
        &worker_url,
        account_id.as_deref(),
        worker_script_name.as_deref(),
        worker_version.as_deref(),
    )
}

#[tauri::command]
pub async fn clear_user_connection() -> Result<(), String> {
    clear_user_connection_data()?;
    Ok(())
}
