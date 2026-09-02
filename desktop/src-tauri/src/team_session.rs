//! Invited (team) session: the per-account mobile password lives in the OS
//! keyring. `team-login.json` keeps only the identity (worker URL +
//! account email); the password is never written to disk.

use crate::secrets::{clear_team_login, load_team_login, save_team_login, TeamLogin};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

const KEYRING_SERVICE: &str = "com.relaybase.desktop";
const KEYRING_USER: &str = "team-session";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamKeyringBlob {
    worker_url: String,
    account_email: String,
    mobile_password: String,
}

struct TeamMemory {
    worker_url: String,
    account_email: String,
    mobile_password: String,
}

static MEMORY: Mutex<Option<TeamMemory>> = Mutex::new(None);

fn load_keyring() -> Result<Option<TeamKeyringBlob>, String> {
    let json = match crate::keyring_store::get_password(KEYRING_SERVICE, KEYRING_USER)? {
        Some(json) => json,
        None => return Ok(None),
    };
    let blob: TeamKeyringBlob = serde_json::from_str(&json)
        .map_err(|e| format!("Corrupt team keyring session: {e}"))?;
    if blob.mobile_password.trim().is_empty()
        || blob.worker_url.trim().is_empty()
        || blob.account_email.trim().is_empty()
    {
        return Ok(None);
    }
    Ok(Some(blob))
}

fn save_keyring(blob: &TeamKeyringBlob) -> Result<(), String> {
    let json = serde_json::to_string(blob).map_err(|e| e.to_string())?;
    crate::keyring_store::set_password(KEYRING_SERVICE, KEYRING_USER, &json)
}

fn delete_keyring() {
    crate::keyring_store::delete_password(KEYRING_SERVICE, KEYRING_USER);
}

fn set_memory(worker_url: &str, account_email: &str, mobile_password: &str) {
    if let Ok(mut guard) = MEMORY.lock() {
        *guard = Some(TeamMemory {
            worker_url: worker_url.trim().trim_end_matches('/').to_string(),
            account_email: account_email.trim().to_lowercase(),
            mobile_password: mobile_password.to_string(),
        });
    }
}

fn clear_memory() {
    if let Ok(mut guard) = MEMORY.lock() {
        *guard = None;
    }
}

fn memory_if_valid() -> Option<TeamMemory> {
    let guard = MEMORY.lock().ok()?;
    let mem = guard.as_ref()?;
    if mem.mobile_password.is_empty() {
        return None;
    }
    Some(TeamMemory {
        worker_url: mem.worker_url.clone(),
        account_email: mem.account_email.clone(),
        mobile_password: mem.mobile_password.clone(),
    })
}

fn platform_name() -> String {
    if cfg!(target_os = "macos") {
        "macos".into()
    } else if cfg!(target_os = "windows") {
        "windows".into()
    } else if cfg!(target_os = "linux") {
        "linux".into()
    } else {
        "other".into()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSessionStatus {
    pub has_secret: bool,
    pub has_access: bool,
    pub account_email: String,
    pub worker_url: String,
    pub platform: String,
}

pub fn team_session_status() -> Result<TeamSessionStatus, String> {
    migrate_legacy_team_login()?;
    let blob = load_keyring()?;
    let access = memory_if_valid();
    let team_login = load_team_login().ok().flatten();
    let disk_worker_url = team_login
        .as_ref()
        .map(|t| t.worker_url.trim().to_string())
        .filter(|u| !u.is_empty());
    let disk_email = team_login
        .as_ref()
        .map(|t| t.account_email.trim().to_string())
        .filter(|e| !e.is_empty());

    let account_email = disk_email
        .or_else(|| access.as_ref().map(|a| a.account_email.clone()))
        .unwrap_or_default();
    let worker_url = disk_worker_url
        .or_else(|| access.as_ref().map(|a| a.worker_url.clone()))
        .unwrap_or_default();

    Ok(TeamSessionStatus {
        has_secret: blob.is_some(),
        has_access: access.is_some(),
        account_email,
        worker_url,
        platform: platform_name(),
    })
}

fn migrate_legacy_team_login() -> Result<(), String> {
    let existing = match load_team_login()? {
        Some(login) => login,
        None => return Ok(()),
    };
    let password = existing.mobile_password.trim().to_string();
    if password.is_empty() {
        return Ok(());
    }
    if load_keyring()?.is_some() {
        let identity = TeamLogin {
            worker_url: existing.worker_url,
            account_email: existing.account_email,
            mobile_password: String::new(),
        };
        save_team_login(&identity)?;
        return Ok(());
    }
    save_keyring(&TeamKeyringBlob {
        worker_url: existing.worker_url.trim().trim_end_matches('/').to_string(),
        account_email: existing.account_email.trim().to_lowercase(),
        mobile_password: password,
    })?;
    let identity = TeamLogin {
        worker_url: existing.worker_url,
        account_email: existing.account_email,
        mobile_password: String::new(),
    };
    save_team_login(&identity)?;
    Ok(())
}

fn json_string<'a>(value: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

pub async fn team_login(
    worker_url: String,
    account_email: String,
    mobile_password: String,
) -> Result<TeamSessionStatus, String> {
    let base = worker_url.trim().trim_end_matches('/');
    let email = account_email.trim().to_lowercase();
    let password = mobile_password.trim().to_string();
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    if email.is_empty() {
        return Err("Account email is required".into());
    }
    if password.is_empty() {
        return Err("Mobile password is required".into());
    }

    let url = format!("{base}/mobile/config");
    let res = reqwest::Client::new()
        .get(&url)
        .header("X-Account-Email", &email)
        .header("Authorization", format!("Bearer {password}"))
        .send()
        .await
        .map_err(|e| format!("Worker request failed: {e}"))?;
    let status = res.status().as_u16();
    let value = res.json::<serde_json::Value>().await.unwrap_or(serde_json::json!({}));
    if status != 200 {
        return Err(json_string(&value, "error")
            .map(str::to_string)
            .unwrap_or_else(|| format!("Worker login failed (HTTP {status})")));
    }

    save_keyring(&TeamKeyringBlob {
        worker_url: base.to_string(),
        account_email: email.clone(),
        mobile_password: password.clone(),
    })?;
    save_team_login(&TeamLogin {
        worker_url: base.to_string(),
        account_email: email.clone(),
        mobile_password: String::new(),
    })?;
    set_memory(base, &email, &password);
    team_session_status()
}

/// Load the mobile password from the keyring into process memory (no biometry).
pub async fn team_unlock() -> Result<TeamSessionStatus, String> {
    let team_login = load_team_login()?.unwrap_or_default();
    if team_login.worker_url.trim().is_empty() {
        return Err("No team worker URL configured in ~/.relaybase".into());
    }
    if memory_if_valid().is_some() {
        return team_session_status();
    }
    let blob = load_keyring()?.ok_or_else(|| {
        "No saved team session. Sign in with your account email and mobile password.".to_string()
    })?;
    set_memory(&blob.worker_url, &blob.account_email, &blob.mobile_password);
    team_session_status()
}

pub async fn team_logout() -> Result<(), String> {
    clear_memory();
    Ok(())
}

pub async fn team_forget_session() -> Result<TeamSessionStatus, String> {
    delete_keyring();
    clear_memory();
    clear_team_login()?;
    team_session_status()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamWorkerRequestInput {
    pub method: String,
    pub path: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamWorkerRequestOutput {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    /// Response body as standard base64 (preserves binary attachment bytes).
    pub body_base64: String,
}

pub async fn team_worker_request(
    input: TeamWorkerRequestInput,
) -> Result<TeamWorkerRequestOutput, String> {
    let mem = memory_if_valid().ok_or_else(|| {
        "Team session locked. Sign in with your mobile password.".to_string()
    })?;
    let path = if input.path.starts_with('/') {
        input.path.clone()
    } else {
        format!("/{}", input.path)
    };
    let url = format!("{}{path}", mem.worker_url);
    let method = reqwest::Method::from_bytes(input.method.trim().as_bytes())
        .unwrap_or(reqwest::Method::GET);
    let client = reqwest::Client::new();
    let mut req = client.request(method, &url);
    if let Some(map) = input.headers {
        for (k, v) in map {
            if k.eq_ignore_ascii_case("authorization") || k.eq_ignore_ascii_case("x-account-email")
            {
                continue;
            }
            req = req.header(k, v);
        }
    }
    req = req
        .header("Authorization", format!("Bearer {}", mem.mobile_password))
        .header("X-Account-Email", &mem.account_email);
    if let Some(body) = input.body {
        req = req.body(body);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("Worker request failed: {e}"))?;
    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter_map(|(k, v)| {
            Some((k.as_str().to_string(), v.to_str().ok()?.to_string()))
        })
        .collect();
    let bytes = res.bytes().await.unwrap_or_default();
    Ok(TeamWorkerRequestOutput {
        status,
        headers,
        body_base64: STANDARD.encode(bytes),
    })
}
