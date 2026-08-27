//! Owner session: refresh lives in the OS keyring, access lives in process
//! memory. The passtoken is never written to disk.
//!
//! Daily unlock: JS calls Touch ID / Windows Hello (`tauri-plugin-biometry`
//! with `allowDeviceCredential`), then `owner_unlock` which reads the keyring
//! and rotates refresh. `tauri dev` unsigned macOS builds often cannot talk
//! to the keychain / LocalAuthentication — fallback is username + passtoken.

use crate::secrets::{load_credentials, save_credentials};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const KEYRING_SERVICE: &str = "com.relaybase.desktop";
const KEYRING_USER: &str = "owner-session";
const ACCESS_SKEW_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyringBlob {
    worker_url: String,
    username: String,
    refresh_token: String,
    /// When false, skip the biometric prompt and use the keyring directly.
    #[serde(default = "default_true")]
    biometry_enabled: bool,
}

fn default_true() -> bool {
    true
}

struct AccessMemory {
    access_token: String,
    expires_at_unix: u64,
    worker_url: String,
    username: String,
}

static ACCESS: Mutex<Option<AccessMemory>> = Mutex::new(None);

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Keyring unavailable: {e}"))
}

fn load_keyring() -> Result<Option<KeyringBlob>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(json) => {
            let blob: KeyringBlob = serde_json::from_str(&json)
                .map_err(|e| format!("Corrupt keyring session: {e}"))?;
            if blob.refresh_token.trim().is_empty() || blob.worker_url.trim().is_empty() {
                return Ok(None);
            }
            Ok(Some(blob))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read keyring: {e}")),
    }
}

fn save_keyring(blob: &KeyringBlob) -> Result<(), String> {
    let json = serde_json::to_string(blob).map_err(|e| e.to_string())?;
    keyring_entry()?
        .set_password(&json)
        .map_err(|e| format!("Failed to write keyring: {e}"))
}

fn delete_keyring() {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
}

fn set_access(worker_url: &str, username: &str, access_token: &str, expires_in: u64) {
    if let Ok(mut guard) = ACCESS.lock() {
        *guard = Some(AccessMemory {
            access_token: access_token.to_string(),
            expires_at_unix: now_unix() + expires_in.saturating_sub(ACCESS_SKEW_SECS).max(5),
            worker_url: worker_url.trim().trim_end_matches('/').to_string(),
            username: username.to_string(),
        });
    }
}

fn clear_access() {
    if let Ok(mut guard) = ACCESS.lock() {
        *guard = None;
    }
}

fn access_if_valid() -> Option<AccessMemory> {
    let guard = ACCESS.lock().ok()?;
    let mem = guard.as_ref()?;
    if mem.access_token.is_empty() || mem.expires_at_unix <= now_unix() {
        return None;
    }
    Some(AccessMemory {
        access_token: mem.access_token.clone(),
        expires_at_unix: mem.expires_at_unix,
        worker_url: mem.worker_url.clone(),
        username: mem.username.clone(),
    })
}

async fn post_json(
    url: &str,
    body: serde_json::Value,
    extra_headers: &[(&str, &str)],
) -> Result<(u16, serde_json::Value), String> {
    let client = reqwest::Client::new();
    let mut req = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body);
    for (k, v) in extra_headers {
        req = req.header(*k, *v);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("Worker request failed: {e}"))?;
    let status = res.status().as_u16();
    let value = res.json::<serde_json::Value>().await.unwrap_or(serde_json::json!({}));
    Ok((status, value))
}

fn json_string<'a>(value: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(|v| v.as_str()).map(str::trim).filter(|s| !s.is_empty())
}

fn persist_worker_url(worker_url: &str) -> Result<(), String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.worker_url = worker_url.trim().trim_end_matches('/').to_string();
    // Never persist owner secrets.
    creds.admin_token.clear();
    save_credentials(&creds)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerSessionStatus {
    pub has_refresh: bool,
    pub has_access: bool,
    pub username: String,
    pub worker_url: String,
    pub biometry_enabled: bool,
    /// "macos" | "windows" | "linux" | other
    pub platform: String,
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

/// Keyring `Err` is returned to the caller. A missing entry is
/// `has_refresh: false`, not a read failure.
pub fn owner_session_status() -> Result<OwnerSessionStatus, String> {
    let blob = load_keyring()?;
    let access = access_if_valid();
    Ok(OwnerSessionStatus {
        has_refresh: blob.is_some(),
        has_access: access.is_some(),
        username: blob
            .as_ref()
            .map(|b| b.username.clone())
            .or_else(|| access.as_ref().map(|a| a.username.clone()))
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

/// POST /console/login. Stores refresh in the OS keyring and access in memory.
/// The passtoken is not retained.
pub async fn owner_login(
    worker_url: String,
    username: String,
    passtoken: String,
    biometry_enabled: Option<bool>,
) -> Result<OwnerSessionStatus, String> {
    let base = worker_url.trim().trim_end_matches('/');
    let username = username.trim().to_lowercase();
    let passtoken = passtoken.trim().to_string();
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    if username.len() < 3 {
        return Err("Username must be at least 3 characters".into());
    }
    if passtoken.is_empty() {
        return Err("Passtoken is required".into());
    }

    let url = format!("{base}/console/login");
    let (status, value) = post_json(
        &url,
        serde_json::json!({
            "username": username,
            "passtoken": passtoken,
            "label": format!("desktop-{}", platform_name()),
        }),
        &[],
    )
    .await?;
    if status == 429 {
        return Err(json_string(&value, "error")
            .unwrap_or("Too many attempts. Try again later.")
            .to_string());
    }
    if status != 200 {
        return Err(json_string(&value, "error")
            .unwrap_or("Invalid credentials")
            .to_string());
    }
    let access = json_string(&value, "accessToken")
        .ok_or_else(|| "Worker login did not return an access token".to_string())?;
    let refresh = json_string(&value, "refreshToken")
        .ok_or_else(|| "Worker login did not return a refresh token".to_string())?;
    let expires_in = value
        .get("expiresIn")
        .and_then(|v| v.as_u64())
        .unwrap_or(600);

    let existing = load_keyring().ok().flatten();
    let biometry = biometry_enabled.unwrap_or(existing.map(|b| b.biometry_enabled).unwrap_or(true));
    save_keyring(&KeyringBlob {
        worker_url: base.to_string(),
        username: username.clone(),
        refresh_token: refresh.to_string(),
        biometry_enabled: biometry,
    })?;
    set_access(base, &username, access, expires_in);
    persist_worker_url(base)?;
    owner_session_status()
}

/// Read refresh from the keyring and rotate it. Caller must have already
/// passed biometric / device-PIN (or opted out of biometry).
pub async fn owner_unlock() -> Result<OwnerSessionStatus, String> {
    if access_if_valid().is_some() {
        return owner_session_status();
    }
    let blob = load_keyring()?.ok_or_else(|| {
        "No saved session. Sign in with your username and passtoken.".to_string()
    })?;
    refresh_with_blob(&blob).await?;
    owner_session_status()
}

async fn refresh_with_blob(blob: &KeyringBlob) -> Result<(), String> {
    let base = blob.worker_url.trim().trim_end_matches('/');
    let url = format!("{base}/console/refresh");
    let (status, value) = post_json(
        &url,
        serde_json::json!({ "refreshToken": blob.refresh_token }),
        &[],
    )
    .await?;
    if status != 200 {
        // Only a 401 means the refresh was revoked. 404/5xx/network-shaped
        // errors must not wipe the keyring — that dumped a successful Touch ID
        // into the passtoken form on the next status read.
        if status == 401 {
            delete_keyring();
            clear_access();
        }
        return Err(json_string(&value, "error")
            .unwrap_or("Session expired. Sign in with your passtoken.")
            .to_string());
    }
    let access = json_string(&value, "accessToken")
        .ok_or_else(|| "Worker refresh did not return an access token".to_string())?;
    let refresh = json_string(&value, "refreshToken")
        .ok_or_else(|| "Worker refresh did not return a refresh token".to_string())?;
    let expires_in = value
        .get("expiresIn")
        .and_then(|v| v.as_u64())
        .unwrap_or(600);
    save_keyring(&KeyringBlob {
        worker_url: base.to_string(),
        username: blob.username.clone(),
        refresh_token: refresh.to_string(),
        biometry_enabled: blob.biometry_enabled,
    })?;
    set_access(base, &blob.username, access, expires_in);
    persist_worker_url(base)?;
    Ok(())
}

pub async fn owner_logout() -> Result<(), String> {
    let blob = load_keyring().ok().flatten();
    let access = access_if_valid();
    if let (Some(blob), Some(access)) = (blob.as_ref(), access.as_ref()) {
        let url = format!(
            "{}/console/logout",
            blob.worker_url.trim().trim_end_matches('/')
        );
        let _ = post_json(
            &url,
            serde_json::json!({ "refreshToken": blob.refresh_token }),
            &[("Authorization", &format!("Bearer {}", access.access_token))],
        )
        .await;
    }
    delete_keyring();
    clear_access();
    Ok(())
}

pub fn owner_set_biometry_enabled(enabled: bool) -> Result<OwnerSessionStatus, String> {
    let mut blob = load_keyring()?.ok_or_else(|| {
        "No saved session. Sign in first.".to_string()
    })?;
    blob.biometry_enabled = enabled;
    save_keyring(&blob)?;
    owner_session_status()
}

/// First-time owner setup. Returns the issued passtoken ONCE. The app must
/// show it and let the user download it — it is not stored.
pub async fn owner_setup_admin(
    worker_url: String,
    username: String,
    pepper: String,
) -> Result<OwnerSetupResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    let username = username.trim().to_lowercase();
    let pepper = pepper.trim();
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    if username.len() < 3 {
        return Err("Username must be at least 3 characters".into());
    }
    if pepper.is_empty() {
        return Err("Install pepper is missing. Re-run install.".into());
    }
    let url = format!("{base}/console/setup-admin");
    let (status, value) = post_json(
        &url,
        serde_json::json!({ "username": username }),
        &[("X-Auth-Pepper", pepper)],
    )
    .await?;
    if status != 201 && status != 200 {
        return Err(json_string(&value, "error")
            .unwrap_or("Could not set up owner")
            .to_string());
    }
    let passtoken = json_string(&value, "passtoken")
        .ok_or_else(|| "Worker did not return a passtoken".to_string())?;
    persist_worker_url(base)?;
    Ok(OwnerSetupResult {
        username: json_string(&value, "username")
            .unwrap_or(&username)
            .to_string(),
        passtoken: passtoken.to_string(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerSetupResult {
    pub username: String,
    pub passtoken: String,
}

/// Forgot-passtoken recovery. The CF access token is held in process memory
/// (OAuth). Returns a new passtoken ONCE.
pub async fn owner_reset_admin(
    worker_url: String,
    cf_access_token: String,
    username: Option<String>,
) -> Result<OwnerSetupResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    let url = format!("{base}/console/reset-admin");
    let mut body = serde_json::json!({ "cfAccessToken": cf_access_token.trim() });
    if let Some(name) = username {
        let name = name.trim().to_lowercase();
        if !name.is_empty() {
            body["username"] = serde_json::Value::String(name);
        }
    }
    let (status, value) = post_json(&url, body, &[]).await?;
    if status != 200 {
        return Err(json_string(&value, "error")
            .unwrap_or("Could not reset passtoken")
            .to_string());
    }
    let passtoken = json_string(&value, "passtoken")
        .ok_or_else(|| "Worker did not return a passtoken".to_string())?;
    delete_keyring();
    clear_access();
    Ok(OwnerSetupResult {
        username: json_string(&value, "username").unwrap_or("").to_string(),
        passtoken: passtoken.to_string(),
    })
}

async fn ensure_access() -> Result<AccessMemory, String> {
    if let Some(mem) = access_if_valid() {
        return Ok(mem);
    }
    let blob = load_keyring()?.ok_or_else(|| "Not signed in".to_string())?;
    refresh_with_blob(&blob).await?;
    access_if_valid().ok_or_else(|| "Not signed in".to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerRequestInput {
    pub method: String,
    pub path: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerRequestOutput {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

/// Attach the in-memory access token and call the customer Worker.
/// On 401, refresh once and retry. Tokens are never returned to JS.
pub async fn worker_request(input: WorkerRequestInput) -> Result<WorkerRequestOutput, String> {
    let mut access = ensure_access().await?;
    let path = if input.path.starts_with('/') {
        input.path.clone()
    } else {
        format!("/{}", input.path)
    };
    let url = format!("{}{path}", access.worker_url);
    let method = reqwest::Method::from_bytes(input.method.trim().as_bytes())
        .unwrap_or(reqwest::Method::GET);

    let do_fetch = |token: String| {
        let url = url.clone();
        let method = method.clone();
        let headers = input.headers.clone();
        let body = input.body.clone();
        async move {
            let client = reqwest::Client::new();
            let mut req = client.request(method, &url);
            if let Some(map) = headers {
                for (k, v) in map {
                    if k.eq_ignore_ascii_case("authorization") {
                        continue;
                    }
                    req = req.header(k, v);
                }
            }
            req = req.header("Authorization", format!("Bearer {token}"));
            if let Some(body) = body {
                req = req.body(body);
            }
            req.send()
                .await
                .map_err(|e| format!("Worker request failed: {e}"))
        }
    };

    let mut res = do_fetch(access.access_token.clone()).await?;
    if res.status().as_u16() == 401 {
        let blob = load_keyring()?.ok_or_else(|| "Not signed in".to_string())?;
        refresh_with_blob(&blob).await?;
        access = access_if_valid().ok_or_else(|| "Not signed in".to_string())?;
        res = do_fetch(access.access_token.clone()).await?;
    }

    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter_map(|(k, v)| {
            Some((k.as_str().to_string(), v.to_str().ok()?.to_string()))
        })
        .collect();
    let body = res.text().await.unwrap_or_default();
    Ok(WorkerRequestOutput {
        status,
        headers,
        body,
    })
}

/// Current access token for Rust-side Worker calls (init-db after login, etc).
pub fn current_access_token() -> Option<String> {
    access_if_valid().map(|m| m.access_token)
}

pub fn current_worker_url() -> Option<String> {
    access_if_valid()
        .map(|m| m.worker_url)
        .or_else(|| load_keyring().ok().flatten().map(|b| b.worker_url))
}
