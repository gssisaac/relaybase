//! Invited (team) session: the per-account mobile password lives in the OS
//! keyring, unlocked daily via Touch ID / Windows Hello — the same machine
//! the owner uses. `team-login.json` keeps only the identity (worker URL +
//! account email); the password is never written to disk.
//!
//! Mirrors `owner_session.rs` but the credential is a static mobile password
//! (no rotation): "access" simply means the password is in process memory
//! for this run.

use crate::secrets::{clear_team_login, load_team_login, save_team_login, TeamLogin};
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
    /// When false, skip the biometric prompt and use the keyring directly.
    #[serde(default = "default_true")]
    biometry_enabled: bool,
}

fn default_true() -> bool {
    true
}

struct TeamMemory {
    worker_url: String,
    account_email: String,
    mobile_password: String,
}

static MEMORY: Mutex<Option<TeamMemory>> = Mutex::new(None);

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Keyring unavailable: {e}"))
}

fn load_keyring() -> Result<Option<TeamKeyringBlob>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(json) => {
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
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read team keyring: {e}")),
    }
}

fn save_keyring(blob: &TeamKeyringBlob) -> Result<(), String> {
    let json = serde_json::to_string(blob).map_err(|e| e.to_string())?;
    keyring_entry()?
        .set_password(&json)
        .map_err(|e| format!("Failed to write team keyring: {e}"))
}

fn delete_keyring() {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
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
    pub biometry_enabled: bool,
    /// "macos" | "windows" | "linux" | other
    pub platform: String,
}

/// Keyring `Err` is returned to the caller. A missing entry is
/// `has_secret: false`, not a read failure. Also runs the one-shot
/// migration of a legacy plaintext `team-login.json` into the keyring.
pub fn team_session_status() -> Result<TeamSessionStatus, String> {
    migrate_legacy_team_login()?;
    let blob = load_keyring()?;
    let access = memory_if_valid();
    Ok(TeamSessionStatus {
        has_secret: blob.is_some(),
        has_access: access.is_some(),
        account_email: blob
            .as_ref()
            .map(|b| b.account_email.clone())
            .or_else(|| access.as_ref().map(|a| a.account_email.clone()))
            .unwrap_or_default(),
        worker_url: blob
            .as_ref()
            .map(|b| b.worker_url.clone())
            .or_else(|| access.as_ref().map(|a| a.worker_url.clone()))
            .unwrap_or_default(),
        biometry_enabled: blob.as_ref().map(|b| b.biometry_enabled).unwrap_or(true),
        platform: platform_name(),
    })
}

/// One-shot migration: a legacy `team-login.json` written with a plaintext
/// `mobilePassword` is moved into the keyring and the file is rewritten as
/// identity-only. Idempotent — no-op when the keyring already holds a secret
/// or the file no longer carries a password.
fn migrate_legacy_team_login() -> Result<(), String> {
    let existing = match load_team_login()? {
        Some(login) => login,
        None => return Ok(()),
    };
    // `load_team_login` returns the legacy password when present.
    let password = existing.mobile_password.trim().to_string();
    if password.is_empty() {
        return Ok(());
    }
    if load_keyring()?.is_some() {
        // Keyring already holds a secret; just scrub the file.
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
        biometry_enabled: true,
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

/// Verify the mobile password against `GET /mobile/config`, then store it in
/// the OS keyring and process memory. `biometry_enabled` controls whether
/// the next unlock prompts Touch ID.
pub async fn team_login(
    worker_url: String,
    account_email: String,
    mobile_password: String,
    biometry_enabled: Option<bool>,
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
            .unwrap_or("Mobile login failed")
            .to_string());
    }

    let existing = load_keyring().ok().flatten();
    let biometry = biometry_enabled
        .unwrap_or(existing.map(|b| b.biometry_enabled).unwrap_or(true));
    save_keyring(&TeamKeyringBlob {
        worker_url: base.to_string(),
        account_email: email.clone(),
        mobile_password: password.clone(),
        biometry_enabled: biometry,
    })?;
    // Persist identity-only team-login.json so the gate knows the user is an
    // invited teammate even before unlock.
    save_team_login(&TeamLogin {
        worker_url: base.to_string(),
        account_email: email.clone(),
        mobile_password: String::new(),
    })?;
    set_memory(base, &email, &password);
    team_session_status()
}

/// Read the mobile password from the keyring into process memory. Caller
/// must have already passed biometric / device-PIN (or opted out of biometry).
pub async fn team_unlock() -> Result<TeamSessionStatus, String> {
    if memory_if_valid().is_some() {
        return team_session_status();
    }
    let blob = load_keyring()?.ok_or_else(|| {
        "No saved team session. Sign in with your account email and mobile password.".to_string()
    })?;
    set_memory(&blob.worker_url, &blob.account_email, &blob.mobile_password);
    team_session_status()
}

/// Lock the team session: drop in-memory password only. The keyring secret
/// (and biometry preference) stay for the next Touch ID unlock.
pub async fn team_logout() -> Result<(), String> {
    clear_memory();
    Ok(())
}

/// Forget the team session entirely: keyring, memory, and identity-only
/// `team-login.json`. Used when switching back to owner login.
pub async fn team_forget_session() -> Result<TeamSessionStatus, String> {
    delete_keyring();
    clear_memory();
    clear_team_login()?;
    team_session_status()
}

pub fn team_set_biometry_enabled(enabled: bool) -> Result<TeamSessionStatus, String> {
    let mut blob = load_keyring()?.ok_or_else(|| {
        "No saved team session. Sign in first.".to_string()
    })?;
    blob.biometry_enabled = enabled;
    save_keyring(&blob)?;
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
    pub body: String,
}

/// Attach the in-memory mobile password as `Authorization: Bearer` plus
/// `X-Account-Email` and call the customer Worker's `/mobile/*` routes.
/// Tokens are never returned to JS.
pub async fn team_worker_request(
    input: TeamWorkerRequestInput,
) -> Result<TeamWorkerRequestOutput, String> {
    let mem = memory_if_valid().ok_or_else(|| "Not signed in".to_string())?;
    let path = if input.path.starts_with('/') {
        input.path.clone()
    } else {
        format!("/{}", input.path)
    };
    let url = format!("{}{path}", mem.worker_url);
    let method = reqwest::Method::from_bytes(input.method.trim().as_bytes())
        .unwrap_or(reqwest::Method::GET);

    let do_fetch = |token: String, email: String| {
        let url = url.clone();
        let method = method.clone();
        let headers = input.headers.clone();
        let body = input.body.clone();
        async move {
            let client = reqwest::Client::new();
            let mut req = client.request(method, &url);
            if let Some(map) = headers {
                for (k, v) in map {
                    if k.eq_ignore_ascii_case("authorization")
                        || k.eq_ignore_ascii_case("x-account-email")
                    {
                        continue;
                    }
                    req = req.header(k, v);
                }
            }
            req = req
                .header("Authorization", format!("Bearer {token}"))
                .header("X-Account-Email", email);
            if let Some(body) = body {
                req = req.body(body);
            }
            req.send()
                .await
                .map_err(|e| format!("Worker request failed: {e}"))
        }
    };

    let res = do_fetch(mem.mobile_password.clone(), mem.account_email.clone()).await?;

    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter_map(|(k, v)| Some((k.as_str().to_string(), v.to_str().ok()?.to_string())))
        .collect();
    let body = res.text().await.unwrap_or_default();
    // 401 means the password was revoked by the admin — drop the session so
    // the user is sent back to the invited login form.
    if status == 401 {
        delete_keyring();
        clear_memory();
    }
    Ok(TeamWorkerRequestOutput {
        status,
        headers,
        body,
    })
}

/// Current account email for Rust-side team calls (if any).
#[allow(dead_code)]
pub fn current_team_email() -> Option<String> {
    memory_if_valid().map(|m| m.account_email)
}
