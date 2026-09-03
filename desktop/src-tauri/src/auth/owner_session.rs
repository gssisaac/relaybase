//! Owner session: mail + console refresh tokens live in OS keyring
//! `owner-session:{workerUrl}`; scoped access tokens live in process memory.
//! The passtoken lives in a **separate** `owner-passtoken:{url}` item
//! (Touch ID to read). Never written to `~/.relaybase`.
//!
//! Boot: silent mail refresh (`owner_boot_mail`). Expired refresh: Touch ID
//! then `owner_login_from_keyring`. Valid console refresh unlocks silently.

use super::keyring_store;
use super::owner_passtoken;
use super::touch_id;
use super::worker_accounts::{
    self, known_worker_urls, remember_worker_url, session_account, worker_urls_equal,
    KEYRING_SERVICE, LEGACY_SESSION_USER,
};
use crate::cloudflare::{resolve_account_id_for_recover_with_hint, secrets_store_accessible};
use crate::storage::{get_cf_oauth_session, load_credentials, save_credentials};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const ACCESS_SKEW_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyringBlob {
    worker_url: String,
    /// Console-scoped refresh (30 min TTL on Worker).
    #[serde(default)]
    refresh_token: String,
    /// Mail-scoped refresh (long TTL on Worker).
    #[serde(default)]
    mail_refresh_token: String,
}

struct AccessMemory {
    access_token: String,
    expires_at_unix: u64,
    worker_url: String,
}

static MAIL_ACCESS: Mutex<Option<AccessMemory>> = Mutex::new(None);
static CONSOLE_ACCESS: Mutex<Option<AccessMemory>> = Mutex::new(None);

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn normalize_keyring(mut blob: KeyringBlob) -> Option<KeyringBlob> {
    if blob.worker_url.trim().is_empty() {
        return None;
    }
    // Legacy v1: single refresh_token was used for both scopes.
    if blob.mail_refresh_token.trim().is_empty() && !blob.refresh_token.trim().is_empty() {
        blob.mail_refresh_token = blob.refresh_token.clone();
    }
    if blob.refresh_token.trim().is_empty() && blob.mail_refresh_token.trim().is_empty() {
        return None;
    }
    Some(blob)
}

fn parse_session_blob(json: &str) -> Result<Option<KeyringBlob>, String> {
    let blob: KeyringBlob = serde_json::from_str(json)
        .map_err(|e| format!("Corrupt keyring session: {e}"))?;
    Ok(normalize_keyring(blob))
}

fn read_legacy_session() -> Result<Option<KeyringBlob>, String> {
    let json = match keyring_store::get_password(KEYRING_SERVICE, LEGACY_SESSION_USER)? {
        Some(json) => json,
        None => return Ok(None),
    };
    parse_session_blob(&json)
}

fn resolve_worker_url(override_url: Option<&str>) -> String {
    if let Some(url) = override_url {
        let normalized = worker_accounts::normalize_worker_url(url);
        if !normalized.is_empty() {
            return normalized;
        }
    }
    if let Ok(Some(creds)) = load_credentials() {
        let normalized = worker_accounts::normalize_worker_url(&creds.worker_url);
        if !normalized.is_empty() {
            return normalized;
        }
    }
    if let Some(mem) = access_if_valid("mail").or_else(|| access_if_valid("console")) {
        let normalized = worker_accounts::normalize_worker_url(&mem.worker_url);
        if !normalized.is_empty() {
            return normalized;
        }
    }
    known_worker_urls()
        .into_iter()
        .next()
        .unwrap_or_default()
}

fn load_keyring(worker_url: Option<&str>) -> Result<Option<KeyringBlob>, String> {
    let url = resolve_worker_url(worker_url);
    if url.is_empty() {
        return read_legacy_session();
    }
    let account = session_account(&url);
    if let Some(json) = keyring_store::get_password(KEYRING_SERVICE, &account)? {
        let _ = remember_worker_url(&url);
        return parse_session_blob(&json);
    }
    if let Some(legacy) = read_legacy_session()? {
        if worker_urls_equal(&legacy.worker_url, &url) {
            save_keyring(&legacy)?;
            keyring_store::delete_password(KEYRING_SERVICE, LEGACY_SESSION_USER);
            return Ok(Some(legacy));
        }
    }
    Ok(None)
}

fn save_keyring(blob: &KeyringBlob) -> Result<(), String> {
    let url = worker_accounts::normalize_worker_url(&blob.worker_url);
    if url.is_empty() {
        return Err("Worker URL is required".into());
    }
    remember_worker_url(&url)?;
    let json = serde_json::to_string(blob).map_err(|e| e.to_string())?;
    keyring_store::set_password(KEYRING_SERVICE, &session_account(&url), &json)?;
    if let Ok(Some(legacy)) = read_legacy_session() {
        if worker_urls_equal(&legacy.worker_url, &url) {
            keyring_store::delete_password(KEYRING_SERVICE, LEGACY_SESSION_USER);
        }
    }
    Ok(())
}

fn delete_keyring(worker_url: &str) {
    let url = worker_accounts::normalize_worker_url(worker_url);
    if url.is_empty() {
        return;
    }
    keyring_store::delete_password(KEYRING_SERVICE, &session_account(&url));
    if let Ok(Some(legacy)) = read_legacy_session() {
        if worker_urls_equal(&legacy.worker_url, &url) {
            keyring_store::delete_password(KEYRING_SERVICE, LEGACY_SESSION_USER);
        }
    }
}

fn access_if_valid_for(scope: &str, worker_url: &str) -> Option<AccessMemory> {
    let mem = access_if_valid(scope)?;
    if worker_urls_equal(&mem.worker_url, worker_url) {
        Some(mem)
    } else {
        None
    }
}

fn set_scoped_access(
    scope: &str,
    worker_url: &str,
    access_token: &str,
    expires_in: u64,
) {
    let mem = AccessMemory {
        access_token: access_token.to_string(),
        expires_at_unix: now_unix() + expires_in.saturating_sub(ACCESS_SKEW_SECS).max(5),
        worker_url: worker_url.trim().trim_end_matches('/').to_string(),
    };
    let lock = if scope == "mail" {
        &MAIL_ACCESS
    } else {
        &CONSOLE_ACCESS
    };
    if let Ok(mut guard) = lock.lock() {
        *guard = Some(mem);
    }
}

fn clear_scoped_access(scope: &str) {
    let lock = if scope == "mail" {
        &MAIL_ACCESS
    } else {
        &CONSOLE_ACCESS
    };
    if let Ok(mut guard) = lock.lock() {
        *guard = None;
    }
}

fn clear_all_access() {
    clear_scoped_access("mail");
    clear_scoped_access("console");
}

fn access_if_valid(scope: &str) -> Option<AccessMemory> {
    let lock = if scope == "mail" {
        MAIL_ACCESS.lock().ok()?
    } else {
        CONSOLE_ACCESS.lock().ok()?
    };
    let mem = lock.as_ref()?;
    if mem.access_token.is_empty() || mem.expires_at_unix <= now_unix() {
        return None;
    }
    Some(AccessMemory {
        access_token: mem.access_token.clone(),
        expires_at_unix: mem.expires_at_unix,
        worker_url: mem.worker_url.clone(),
    })
}

fn worker_scope_for_path(path: &str) -> &'static str {
    let p = path.trim();
    let p = if p.starts_with('/') { p } else { return "console" };
    if p.starts_with("/mail/") || p == "/mail" {
        "mail"
    } else {
        "console"
    }
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

fn worker_error_message(value: &serde_json::Value, fallback: &str) -> String {
    let error = json_string(value, "error").unwrap_or(fallback);
    match json_string(value, "detail") {
        Some(detail) if !error.contains(detail) => format!("{error}: {detail}"),
        _ => error.to_string(),
    }
}

fn normalize_passtoken(raw: &str) -> String {
    let mut token = raw.trim().to_string();
    if let Some(rest) = token.strip_prefix("PASSTOKEN=") {
        token = rest.trim().to_string();
    } else if let Some(rest) = token.strip_prefix("passtoken=") {
        token = rest.trim().to_string();
    }
    if (token.starts_with('"') && token.ends_with('"') && token.len() >= 2)
        || (token.starts_with('\'') && token.ends_with('\'') && token.len() >= 2)
    {
        token = token[1..token.len() - 1].trim().to_string();
    }
    token.retain(|c| !c.is_whitespace());
    token
}

fn persist_worker_url(worker_url: &str) -> Result<(), String> {
    let url = worker_accounts::normalize_worker_url(worker_url);
    remember_worker_url(&url)?;
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.worker_url = url;
    save_credentials(&creds)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerSessionStatus {
    pub has_mail_refresh: bool,
    pub has_console_refresh: bool,
    pub has_mail_access: bool,
    pub has_console_access: bool,
    /// Back-compat: any keyring refresh present.
    pub has_refresh: bool,
    /// Back-compat: mail OR console access in memory.
    pub has_access: bool,
    /// Keyring `owner-passtoken:{url}` exists with valid format (secret is not returned).
    pub has_passtoken: bool,
    /// First 10 chars after `rb_pass_` from the keyring record (empty when none).
    pub keyring_passtoken_prefix: String,
    pub worker_url: String,
    /// Worker URLs that have a keyring passtoken or session on this Mac.
    pub known_worker_urls: Vec<String>,
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

pub fn owner_session_status(worker_url: Option<&str>) -> Result<OwnerSessionStatus, String> {
    let url = resolve_worker_url(worker_url);
    let url_ref = if url.is_empty() { None } else { Some(url.as_str()) };
    let blob = load_keyring(url_ref)?;
    let mail_access = if url.is_empty() {
        access_if_valid("mail")
    } else {
        access_if_valid_for("mail", &url)
    };
    let console_access = if url.is_empty() {
        access_if_valid("console")
    } else {
        access_if_valid_for("console", &url)
    };
    let has_mail_refresh = blob
        .as_ref()
        .map(|b| !b.mail_refresh_token.trim().is_empty())
        .unwrap_or(false);
    let has_console_refresh = blob
        .as_ref()
        .map(|b| !b.refresh_token.trim().is_empty())
        .unwrap_or(false);
    let mut known = owner_passtoken::listed_worker_urls();
    if !url.is_empty() && !known.iter().any(|existing| worker_urls_equal(existing, &url)) {
        known.push(url.clone());
    }
    Ok(OwnerSessionStatus {
        has_mail_refresh,
        has_console_refresh,
        has_mail_access: mail_access.is_some(),
        has_console_access: console_access.is_some(),
        has_refresh: has_mail_refresh || has_console_refresh,
        has_access: mail_access.is_some() || console_access.is_some(),
        has_passtoken: owner_passtoken::is_stored(url_ref),
        keyring_passtoken_prefix: owner_passtoken::stored_prefix(url_ref),
        worker_url: url,
        known_worker_urls: known,
        platform: platform_name(),
    })
}

async fn refresh_scope(blob: &KeyringBlob, scope: &str) -> Result<KeyringBlob, String> {
    let base = blob.worker_url.trim().trim_end_matches('/');
    let refresh = if scope == "mail" {
        blob.mail_refresh_token.trim()
    } else {
        blob.refresh_token.trim()
    };
    if refresh.is_empty() {
        return Err(if scope == "mail" {
            "No saved mail session. Sign in with your passtoken.".to_string()
        } else {
            "No saved console session. Unlock the dashboard with Touch ID or passtoken."
                .to_string()
        });
    }
    let url = format!("{base}/console/refresh");
    let (status, value) = post_json(
        &url,
        serde_json::json!({ "refreshToken": refresh, "scope": scope }),
        &[],
    )
    .await?;
    if status != 200 {
        if status == 401 {
            if scope == "mail" {
                let mut wiped = blob.clone();
                wiped.mail_refresh_token.clear();
                if wiped.refresh_token.trim().is_empty() {
                    delete_keyring(&blob.worker_url);
                    clear_all_access();
                } else if let Some(normalized) = normalize_keyring(wiped) {
                    let _ = save_keyring(&normalized);
                    clear_scoped_access("mail");
                }
            } else {
                let mut wiped = blob.clone();
                wiped.refresh_token.clear();
                if wiped.mail_refresh_token.trim().is_empty() {
                    delete_keyring(&blob.worker_url);
                    clear_all_access();
                } else if let Some(normalized) = normalize_keyring(wiped) {
                    let _ = save_keyring(&normalized);
                    clear_scoped_access("console");
                }
            }
        }
        return Err(json_string(&value, "error")
            .unwrap_or("Session expired. Sign in with your passtoken.")
            .to_string());
    }
    let access = json_string(&value, "accessToken")
        .ok_or_else(|| "Worker refresh did not return an access token".to_string())?;
    let new_refresh = json_string(&value, "refreshToken")
        .ok_or_else(|| "Worker refresh did not return a refresh token".to_string())?;
    let expires_in = value
        .get("expiresIn")
        .and_then(|v| v.as_u64())
        .unwrap_or(600);
    let mut updated = blob.clone();
    if scope == "mail" {
        updated.mail_refresh_token = new_refresh.to_string();
    } else {
        updated.refresh_token = new_refresh.to_string();
    }
    save_keyring(&updated)?;
    set_scoped_access(scope, base, access, expires_in);
    if load_credentials()?.is_some() {
        persist_worker_url(base)?;
    }
    Ok(updated)
}

/// POST /console/login. Stores both refresh tokens; mail access in memory only.
pub async fn owner_login(
    worker_url: String,
    passtoken: String,
) -> Result<OwnerSessionStatus, String> {
    let base = worker_url.trim().trim_end_matches('/');
    let passtoken = normalize_passtoken(&passtoken);
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    if passtoken.is_empty() {
        return Err("Passtoken is required".into());
    }
    if !passtoken.starts_with("rb_pass_") {
        return Err(
            "Passtoken must start with rb_pass_. Paste only the token, not a PASSTOKEN= line."
                .into(),
        );
    }

    let url = format!("{base}/console/login");
    let (status, value) = post_json(
        &url,
        serde_json::json!({
            "passtoken": passtoken,
            "label": format!("desktop-{}", platform_name()),
        }),
        &[],
    )
    .await?;
    if status != 200 {
        return Err(json_string(&value, "error")
            .map(str::to_string)
            .unwrap_or_else(|| {
                if status == 401 {
                    "Invalid credentials. Check the passtoken (paste only the rb_pass_… token)."
                        .to_string()
                } else {
                    format!("Worker login failed (HTTP {status})")
                }
            }));
    }
    let mail_access = json_string(&value, "mailAccessToken")
        .ok_or_else(|| "Worker login did not return a mail access token".to_string())?;
    let mail_refresh = json_string(&value, "mailRefreshToken")
        .ok_or_else(|| "Worker login did not return a mail refresh token".to_string())?;
    let console_refresh = json_string(&value, "consoleRefreshToken")
        .ok_or_else(|| "Worker login did not return a console refresh token".to_string())?;
    let expires_in = value
        .get("mailExpiresIn")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);

    save_keyring(&KeyringBlob {
        worker_url: base.to_string(),
        refresh_token: console_refresh.to_string(),
        mail_refresh_token: mail_refresh.to_string(),
    })?;
    set_scoped_access("mail", base, mail_access, expires_in);
    clear_scoped_access("console");
    persist_worker_url(base)?;
    owner_passtoken::store(&passtoken, base)?;
    owner_session_status(Some(base))
}

/// Silent boot mail unlock — no biometry.
pub async fn owner_boot_mail() -> Result<OwnerSessionStatus, String> {
    let creds = load_credentials()?.unwrap_or_default();
    let url = worker_accounts::normalize_worker_url(&creds.worker_url);
    if url.is_empty() {
        return Err("No worker URL configured in ~/.relaybase".into());
    }
    if access_if_valid_for("mail", &url).is_some() {
        return owner_session_status(Some(&url));
    }
    let blob = load_keyring(Some(&url))?.ok_or_else(|| {
        "No saved session. Sign in with your passtoken.".to_string()
    })?;
    if blob.mail_refresh_token.trim().is_empty() {
        return Err(
            "Mail session missing. Sign in with your passtoken once.".to_string(),
        );
    }
    refresh_scope(&blob, "mail").await?;
    owner_session_status(Some(&url))
}

/// Console unlock from a valid console refresh — no biometry.
pub async fn owner_unlock_console() -> Result<OwnerSessionStatus, String> {
    let url = resolve_worker_url(None);
    if !url.is_empty() && access_if_valid_for("console", &url).is_some() {
        return owner_session_status(Some(&url));
    }
    let blob = load_keyring(if url.is_empty() { None } else { Some(&url) })?.ok_or_else(|| {
        "No saved session. Sign in with your passtoken.".to_string()
    })?;
    if blob.refresh_token.trim().is_empty() {
        return Err(
            "Console session expired. Sign in with your passtoken.".to_string(),
        );
    }
    refresh_scope(&blob, "console").await?;
    owner_session_status(Some(&blob.worker_url))
}

pub async fn owner_logout() -> Result<(), String> {
    clear_all_access();
    Ok(())
}

pub async fn owner_setup_admin(
    worker_url: String,
    pepper: String,
) -> Result<OwnerSetupResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    let pepper = pepper.trim();
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    if pepper.is_empty() {
        return Err("Install pepper is missing. Re-run install.".into());
    }
    let url = format!("{base}/console/setup-admin");
    let (status, value) = post_json(
        &url,
        serde_json::json!({}),
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
    owner_passtoken::store(passtoken, base)?;
    Ok(OwnerSetupResult {
        passtoken: passtoken.to_string(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerSetupResult {
    pub passtoken: String,
}

async fn get_json(url: &str) -> Result<(u16, serde_json::Value), String> {
    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Worker request failed: {e}"))?;
    let status = res.status().as_u16();
    let value = res
        .json::<serde_json::Value>()
        .await
        .unwrap_or(serde_json::json!({}));
    Ok((status, value))
}

fn is_cf_account_id(value: &str) -> bool {
    let id = value.trim();
    id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit())
}

async fn worker_cf_account_hint(worker_url: &str) -> Option<String> {
    let url = format!(
        "{}/console/auth-status",
        worker_url.trim().trim_end_matches('/')
    );
    let (status, value) = get_json(&url).await.ok()?;
    if status != 200 {
        return None;
    }
    json_string(&value, "cfAccountId").and_then(|s| {
        if is_cf_account_id(s) {
            Some(s.to_string())
        } else {
            None
        }
    })
}

async fn resolve_reset_cf_account_id(token: &str, worker_url: &str) -> Option<String> {
    let creds = load_credentials().ok().flatten().unwrap_or_default();
    let from_disk = creds.account_id.trim();
    if !from_disk.is_empty() {
        return Some(from_disk.to_string());
    }
    if let Some(session) = get_cf_oauth_session() {
        let from_session = session.account_id.trim();
        if !from_session.is_empty() {
            return Some(from_session.to_string());
        }
    }
    if let Some(hint) = worker_cf_account_hint(worker_url).await {
        if secrets_store_accessible(token, &hint).await {
            return Some(hint);
        }
    }
    resolve_account_id_for_recover_with_hint(token, None)
        .await
        .ok()
}

/// Re-issue owner passtoken. `cf_access_token` is the Cloudflare OAuth
/// access token only.
pub async fn owner_reset_admin(
    worker_url: String,
    cf_access_token: String,
) -> Result<OwnerSetupResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is required".into());
    }
    let token = cf_access_token.trim();
    if token.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    let account_id = resolve_reset_cf_account_id(token, base).await;
    if let Some(ref id) = account_id {
        let creds = load_credentials()?.unwrap_or_default();
        if creds.account_id.trim().is_empty() {
            let mut next = creds;
            next.account_id = id.clone();
            save_credentials(&next)?;
        }
    }
    let url = format!("{base}/console/reset-admin");
    let mut body = serde_json::json!({ "cfAccessToken": token });
    if let Some(id) = account_id {
        body["cfAccountId"] = serde_json::Value::String(id);
    }
    let (status, value) = post_json(&url, body, &[]).await?;
    if status != 200 {
        return Err(worker_error_message(&value, "Could not reset passtoken"));
    }
    let passtoken = json_string(&value, "passtoken")
        .ok_or_else(|| "Worker did not return a passtoken".to_string())?;
    delete_keyring(base);
    clear_all_access();
    owner_passtoken::delete(base);
    owner_passtoken::store(passtoken, base)?;
    Ok(OwnerSetupResult {
        passtoken: passtoken.to_string(),
    })
}

/// Touch ID (macOS / Windows) then read `owner-passtoken:{url}` and POST `/console/login`.
/// Linux / no-biometry platforms read the item without a prompt.
/// The passtoken is never returned to JS.
pub async fn owner_login_from_keyring(
    app: tauri::AppHandle,
    reason: String,
    worker_url_override: Option<String>,
) -> Result<OwnerSessionStatus, String> {
    let worker_url = resolve_worker_url(worker_url_override.as_deref());
    if worker_url.is_empty() {
        return Err("Worker URL is required".into());
    }
    if !owner_passtoken::is_stored(Some(&worker_url)) {
        return Err("No stored passtoken for this Worker.".into());
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        touch_id::authenticate(app, reason).await?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, reason);
    }
    let record = owner_passtoken::load_after_auth(Some(&worker_url))?
        .ok_or_else(|| "No stored passtoken for this Worker.".to_string())?;
    match owner_login(worker_url.clone(), record.passtoken).await {
        Ok(status) => Ok(status),
        Err(err) if err.contains("Invalid credentials") => {
            owner_passtoken::delete(&worker_url);
            Err(
                "Stored passtoken didn't match this Worker. Paste your current passtoken."
                    .into(),
            )
        }
        Err(err) => Err(err),
    }
}

async fn ensure_access(scope: &str) -> Result<AccessMemory, String> {
    if let Some(mem) = access_if_valid(scope) {
        return Ok(mem);
    }
    let blob = load_keyring(None)?.ok_or_else(|| "Not signed in".to_string())?;
    refresh_scope(&blob, scope).await?;
    access_if_valid_for(scope, &blob.worker_url).ok_or_else(|| "Not signed in".to_string())
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
    /// Response body as standard base64 (preserves binary attachment bytes).
    pub body_base64: String,
}

pub async fn worker_request(input: WorkerRequestInput) -> Result<WorkerRequestOutput, String> {
    let path = if input.path.starts_with('/') {
        input.path.clone()
    } else {
        format!("/{}", input.path)
    };
    let scope = worker_scope_for_path(&path);
    let mut access = ensure_access(scope).await?;
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
        let blob = load_keyring(Some(&access.worker_url))?
            .ok_or_else(|| "Not signed in".to_string())?;
        refresh_scope(&blob, scope).await?;
        access = access_if_valid_for(scope, &access.worker_url)
            .ok_or_else(|| "Not signed in".to_string())?;
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
    let bytes = res.bytes().await.unwrap_or_default();
    Ok(WorkerRequestOutput {
        status,
        headers,
        body_base64: STANDARD.encode(bytes),
    })
}

pub fn current_access_token() -> Option<String> {
    access_if_valid("console")
        .map(|m| m.access_token)
        .or_else(|| access_if_valid("mail").map(|m| m.access_token))
}

pub fn current_console_access_token() -> Option<String> {
    access_if_valid("console").map(|m| m.access_token)
}
